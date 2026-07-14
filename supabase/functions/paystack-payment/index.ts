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
    const { phone, email, amount_ngn, package_id, mac_address } = await req.json();

    if (!phone || !amount_ngn || !package_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, email, amount_ngn, package_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Nigerian phone number
    if (!/^(0[7-9][01]\d{8})$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid Nigerian phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch package details
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name, price_ngn, duration_hours')
      .eq('id', package_id)
      .eq('is_active', true)
      .maybeSingle();

    if (pkgError || !pkg) {
      return new Response(
        JSON.stringify({ error: 'Package not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Paystack not configured. Please set PAYSTACK_SECRET_KEY in Supabase secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique transaction reference
    const reference = `nc_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    const amountKobo = Math.round(amount_ngn * 100); // Paystack uses kobo

    // Create Paystack transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        currency: 'NGN',
        metadata: {
          phone,
          mac_address: mac_address ?? '',
          package_id,
          package_name: pkg.name,
          custom_fields: [
            { display_name: 'Phone', variable_name: 'phone', value: phone },
            { display_name: 'Package', variable_name: 'package', value: pkg.name },
          ],
        },
        callback_url: `${Deno.env.get('FRONTEND_URL') ?? 'https://your-app.com'}/payment/verify?ref=${reference}`,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status || !paystackData.data?.authorization_url) {
      console.error('Paystack init error:', paystackData);
      return new Response(
        JSON.stringify({ error: paystackData.message ?? 'Failed to initialize Paystack payment' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record pending transaction in DB
    const { error: insertError } = await supabase.from('payments').insert({
      phone,
      amount_ngn,
      package_id,
      package_name: pkg.name,
      transaction_id: reference,
      paystack_ref: reference,
      mac_address: mac_address ?? '',
      status: 'pending',
      payment_method: 'card',
    });

    if (insertError) {
      console.error('DB insert error:', insertError);
    }

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        transaction_id: reference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('paystack-payment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
