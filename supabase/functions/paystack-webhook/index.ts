import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { event, data } = payload;

    // Only process successful charge events
    if (event !== 'charge.success') {
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reference = data?.reference;
    if (!reference) {
      return new Response(JSON.stringify({ error: 'Missing reference' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ error: 'Paystack not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify with Paystack API
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('Paystack verification failed:', verifyData);
      return new Response(JSON.stringify({ error: 'Payment verification failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('paystack_ref', reference)
      .maybeSingle();

    if (paymentError || !payment) {
      console.error('Payment not found:', reference);
      return new Response(JSON.stringify({ error: 'Payment record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency: already processed
    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get package for duration
    const { data: pkg } = await supabase
      .from('packages')
      .select('duration_hours')
      .eq('id', payment.package_id)
      .maybeSingle();

    const expiresAt = pkg
      ? new Date(Date.now() + pkg.duration_hours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        expires_at: expiresAt,
        payment_method: verifyData.data?.channel === 'bank' ? 'bank_transfer' :
          verifyData.data?.channel === 'ussd' ? 'ussd' : 'card',
      })
      .eq('paystack_ref', reference);

    // Upsert hotspot user
    if (payment.mac_address && payment.phone) {
      await supabase.from('hotspot_users').upsert({
        phone: payment.phone,
        mac_address: payment.mac_address,
        status: 'active',
        current_package_id: payment.package_id,
        expires_at: expiresAt,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'mac_address' });
    }

    // Attempt MikroTik relay activation immediately
    let mikrotikOk = false;
    const relayUrl    = Deno.env.get('MIKROTIK_RELAY_URL');
    const relaySecret = Deno.env.get('MIKROTIK_RELAY_SECRET');

    if (relayUrl && relaySecret && payment.mac_address) {
      try {
        const res = await fetch(`${relayUrl}/mikrotik/voucher/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
          body: JSON.stringify({
            userId: '',
            macAddress: payment.mac_address,
            profile: payment.package_name ?? 'default',
            limitUptime: `${pkg?.duration_hours ?? 24}h`,
          }),
          signal: AbortSignal.timeout(8000),
        });
        mikrotikOk = res.ok;
        console.log(`MikroTik activation for ${payment.mac_address}: ${mikrotikOk ? 'OK' : 'FAILED'}`);
      } catch (e) {
        console.warn('MikroTik relay call failed (non-fatal):', e);
      }
    }

    // Update payment with activation result
    await supabase.from('payments').update({
      mikrotik_activated: mikrotikOk,
      activation_attempts: 1,
      last_activation_at: new Date().toISOString(),
    }).eq('id', payment.id);

    // If MikroTik activation failed, queue for auto-retry (Level 3)
    if (!mikrotikOk && payment.mac_address) {
      await supabase.from('pending_activations').upsert({
        payment_id: payment.id,
        phone: payment.phone,
        mac_address: payment.mac_address,
        package_name: payment.package_name ?? 'default',
        expires_at: expiresAt,
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
        status: 'pending',
      }, { onConflict: 'payment_id' });
      console.log(`Queued pending activation for payment ${payment.id}`);
    }

    console.log(`Payment ${reference} completed for ${payment.phone} | MikroTik: ${mikrotikOk}`);

    return new Response(JSON.stringify({ success: true, mikrotik_activated: mikrotikOk }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
