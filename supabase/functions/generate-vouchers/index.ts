import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Generate random alphanumeric code
function generateCode(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusable chars
  let code = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += chars[byte % chars.length];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      package_id,
      quantity = 1,
      price_ngn,
      reseller_price_ngn,
      expires_at,
    } = await req.json();

    if (!package_id || !price_ngn) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: package_id, price_ngn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qty = Math.min(Math.max(1, Number(quantity)), 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify package exists
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name, duration_hours')
      .eq('id', package_id)
      .maybeSingle();

    if (pkgError || !pkg) {
      return new Response(
        JSON.stringify({ error: 'Package not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch existing codes to avoid duplicates
    const { data: existingCodes } = await supabase
      .from('vouchers')
      .select('code')
      .order('created_at', { ascending: false })
      .limit(10000);

    const usedCodes = new Set((existingCodes ?? []).map((v: { code: string }) => v.code));
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Generate unique codes
    const newCodes: string[] = [];
    let attempts = 0;
    while (newCodes.length < qty && attempts < qty * 10) {
      const code = generateCode(10);
      if (!usedCodes.has(code) && !newCodes.includes(code)) {
        newCodes.push(code);
      }
      attempts++;
    }

    if (newCodes.length < qty) {
      return new Response(
        JSON.stringify({ error: 'Could not generate enough unique codes. Try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vouchers = newCodes.map(code => ({
      code,
      package_id: pkg.id,
      package_name: pkg.name,
      validity_hours: pkg.duration_hours,
      price_ngn: Number(price_ngn),
      reseller_price_ngn: reseller_price_ngn ? Number(reseller_price_ngn) : null,
      status: 'active',
      expires_at: expires_at ?? null,
      batch_id: batchId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('vouchers')
      .insert(vouchers)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save vouchers: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(inserted), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-vouchers error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
