import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();

    // 1. Count expired completed payments (read-only log — no status change needed
    //    because 'expired' is not a valid Payment status; expiry is enforced by expires_at)
    const { data: expiredPayments, error: payError } = await supabase
      .from('payments')
      .select('id, phone, mac_address, package_name')
      .lt('expires_at', now)
      .eq('status', 'completed');

    if (payError) console.error('Payment expiry query error:', payError);

    // 2. Deactivate hotspot users whose session has expired
    const { data: expiredUsers, error: userError } = await supabase
      .from('hotspot_users')
      .update({ status: 'inactive' })
      .lt('expires_at', now)
      .eq('status', 'active')
      .select('id, phone, mac_address');

    if (userError) console.error('User expiry error:', userError);

    // 3. Expire vouchers whose expires_at has passed and are still active
    const { data: expiredVouchers, error: vouchError } = await supabase
      .from('vouchers')
      .update({ status: 'expired' })
      .lt('expires_at', now)
      .eq('status', 'active')
      .select('id, code');

    if (vouchError) console.error('Voucher expiry error:', vouchError);

    // 4. Auto-retry pending MikroTik activations (Level 3)
    const MAX_ATTEMPTS = 5;
    const relayUrl    = Deno.env.get('MIKROTIK_RELAY_URL');
    const relaySecret = Deno.env.get('MIKROTIK_RELAY_SECRET');
    let retried = 0;
    let retriedOk = 0;

    const { data: pendingList } = await supabase
      .from('pending_activations')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', now)           // skip already-expired sessions
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(20);

    if (pendingList && pendingList.length > 0 && relayUrl && relaySecret) {
      for (const item of pendingList) {
        retried++;
        let ok = false;
        try {
          // Calculate remaining uptime in minutes (cap at original expiry)
          const remaining = Math.max(0,
            (new Date(item.expires_at).getTime() - Date.now()) / 1000 / 60
          );
          const res = await fetch(`${relayUrl}/mikrotik/voucher/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
            body: JSON.stringify({
              userId: '',
              macAddress: item.mac_address,
              profile: item.package_name ?? 'default',
              limitUptime: `${Math.ceil(remaining)}m`,
            }),
            signal: AbortSignal.timeout(7000),
          });
          ok = res.ok;
        } catch (e) {
          console.warn(`Retry activation failed for ${item.id}:`, e);
        }

        if (ok) {
          retriedOk++;
          // Mark activated + update payment record
          await supabase.from('pending_activations')
            .update({ status: 'activated', last_attempt_at: now, error_message: null })
            .eq('id', item.id);
          await supabase.from('payments')
            .update({ mikrotik_activated: true, last_activation_at: now })
            .eq('id', item.payment_id);
        } else {
          const newAttempts = (item.attempts ?? 0) + 1;
          const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
          await supabase.from('pending_activations')
            .update({
              attempts: newAttempts,
              last_attempt_at: now,
              status: newStatus,
              error_message: 'Relay returned non-OK or timed out',
            })
            .eq('id', item.id);
        }
      }
    }

    // 5. Mark pending_activations as expired if session has now expired
    await supabase.from('pending_activations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now);

    const summary = {
      ran_at: now,
      expired_users: expiredUsers?.length ?? 0,
      expired_vouchers: expiredVouchers?.length ?? 0,
      expired_payments_logged: expiredPayments?.length ?? 0,
      macs_to_remove: expiredUsers?.map(u => u.mac_address).filter(Boolean) ?? [],
      activation_retried: retried,
      activation_retry_ok: retriedOk,
    };

    console.log('expire-sessions completed:', JSON.stringify(summary));

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('expire-sessions error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
