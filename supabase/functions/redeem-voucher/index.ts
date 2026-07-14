import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── MikroTik Relay helpers ───────────────────────────────────────────────────
// The relay is a small Node.js server running on your VPS or Raspberry Pi.
// It bridges Supabase Edge Functions (cloud) ↔ MikroTik REST API (local LAN).
// Set MIKROTIK_RELAY_URL  e.g. https://your-vps.example.com:3000
// Set MIKROTIK_RELAY_SECRET  (any strong random string, same in relay .env)

interface MikroTikUser {
  '.id': string;
  name: string;
  password: string;
  profile: string;
  'limit-uptime'?: string;   // e.g. "1h", "1d"
  comment?: string;
  disabled?: string;
}

async function mikrotikFindVoucher(code: string): Promise<MikroTikUser | null> {
  const relayUrl = Deno.env.get('MIKROTIK_RELAY_URL');
  const relaySecret = Deno.env.get('MIKROTIK_RELAY_SECRET');
  if (!relayUrl || !relaySecret) return null; // relay not configured → skip

  try {
    const res = await fetch(`${relayUrl}/mikrotik/voucher/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-secret': relaySecret,
      },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(8000), // 8s max — don't block user
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch (err) {
    console.warn('MikroTik relay query failed (non-fatal):', err);
    return null;
  }
}

async function mikrotikActivateUser(params: {
  userId: string;
  macAddress: string;
  profile: string;
  limitUptime: string;
}): Promise<boolean> {
  const relayUrl = Deno.env.get('MIKROTIK_RELAY_URL');
  const relaySecret = Deno.env.get('MIKROTIK_RELAY_SECRET');
  if (!relayUrl || !relaySecret) return false;

  try {
    const res = await fetch(`${relayUrl}/mikrotik/voucher/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-secret': relaySecret,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn('MikroTik activate failed (non-fatal):', err);
    return false;
  }
}

// Parse MikroTik limit-uptime string like "1h", "24h", "1d" → hours
function parseUptimeHours(uptime?: string): number {
  if (!uptime) return 1;
  const lower = uptime.toLowerCase().trim();
  if (lower.endsWith('d')) return parseFloat(lower) * 24;
  if (lower.endsWith('h')) return parseFloat(lower);
  if (lower.endsWith('m')) return parseFloat(lower) / 60;
  return 1; // default 1 hour
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, phone, mac_address } = await req.json();

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Voucher code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cleanCode = code.trim().toUpperCase();
    const redeemPhone = phone && phone.trim() ? phone.trim() : null;
    const now = new Date().toISOString();

    // ── STEP 1: Check Supabase-generated vouchers first ──────────────────────
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (voucherError) {
      console.error('Voucher lookup error:', voucherError);
      return new Response(
        JSON.stringify({ success: false, message: 'Error looking up voucher. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STEP 2: If found in Supabase → use existing platform flow ─────────────
    if (voucher) {
      if (voucher.status === 'used') {
        return new Response(
          JSON.stringify({ success: false, message: 'This voucher has already been redeemed.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (voucher.status === 'expired') {
        return new Response(
          JSON.stringify({ success: false, message: 'This voucher has expired.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
        await supabase.from('vouchers').update({ status: 'expired' }).eq('id', voucher.id);
        return new Response(
          JSON.stringify({ success: false, message: 'This voucher has expired.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expiresAt = new Date(Date.now() + voucher.validity_hours * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('vouchers')
        .update({
          status: 'used',
          redeemed_by_phone: redeemPhone,
          redeemed_by_mac: mac_address ?? null,
          redeemed_at: now,
        })
        .eq('id', voucher.id)
        .eq('status', 'active');

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to redeem voucher. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('payments').insert({
        phone: redeemPhone ?? 'voucher-user',
        amount_ngn: voucher.price_ngn,
        package_id: voucher.package_id,
        package_name: voucher.package_name,
        transaction_id: `vchr_${voucher.code}`,
        mac_address: mac_address ?? '',
        status: 'completed',
        payment_method: 'voucher',
        expires_at: expiresAt,
      });

      if (mac_address) {
        await supabase.from('hotspot_users').upsert({
          phone: redeemPhone ?? 'voucher-user',
          mac_address,
          status: 'active',
          current_package_id: voucher.package_id,
          expires_at: expiresAt,
          last_seen: now,
        }, { onConflict: 'mac_address' });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Voucher redeemed! You have ${voucher.validity_hours} hour(s) of access.`,
          expires_at: expiresAt,
          source: 'platform',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STEP 3: NOT in Supabase → query MikroTik router via relay ─────────────
    console.log(`Code "${cleanCode}" not in Supabase — querying MikroTik relay…`);
    const mkUser = await mikrotikFindVoucher(cleanCode);

    if (!mkUser) {
      // Relay not configured OR code genuinely not found anywhere
      const relayConfigured = !!Deno.env.get('MIKROTIK_RELAY_URL');
      const message = relayConfigured
        ? 'Invalid voucher code. Please check and try again.'
        : 'Invalid voucher code. (MikroTik relay not connected — contact admin)';
      return new Response(
        JSON.stringify({ success: false, message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Voucher found on MikroTik router
    if (mkUser.disabled === 'true') {
      return new Response(
        JSON.stringify({ success: false, message: 'This voucher has already been used.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validityHours = parseUptimeHours(mkUser['limit-uptime']);
    const expiresAt = new Date(Date.now() + validityHours * 60 * 60 * 1000).toISOString();

    // Activate on MikroTik: disable voucher user + whitelist MAC
    const activated = await mikrotikActivateUser({
      userId: mkUser['.id'],
      macAddress: mac_address ?? '',
      profile: mkUser.profile ?? 'default',
      limitUptime: mkUser['limit-uptime'] ?? '1h',
    });

    if (!activated) {
      console.warn('MikroTik activation call failed — recording redemption in DB anyway');
    }

    // Record redemption in Supabase for analytics and expiry tracking
    await supabase.from('vouchers').insert({
      code: cleanCode,
      package_id: null,
      package_name: mkUser.profile ?? 'MikroTik Voucher',
      validity_hours: validityHours,
      price_ngn: 0,
      status: 'used',
      redeemed_by_phone: redeemPhone,
      redeemed_by_mac: mac_address ?? null,
      redeemed_at: now,
      batch_id: mkUser.comment ?? 'mikrotik-import',
    });

    await supabase.from('payments').insert({
      phone: redeemPhone ?? 'voucher-user',
      amount_ngn: 0,
      package_id: null,
      package_name: mkUser.profile ?? 'MikroTik Voucher',
      transaction_id: `mk_${cleanCode}`,
      mac_address: mac_address ?? '',
      status: 'completed',
      payment_method: 'voucher',
      expires_at: expiresAt,
    });

    if (mac_address) {
      await supabase.from('hotspot_users').upsert({
        phone: redeemPhone ?? 'voucher-user',
        mac_address,
        status: 'active',
        current_package_id: null,
        expires_at: expiresAt,
        last_seen: now,
      }, { onConflict: 'mac_address' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Voucher redeemed! You have ${validityHours} hour(s) of access.`,
        expires_at: expiresAt,
        source: 'mikrotik',
        router_activated: activated,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('redeem-voucher error:', err);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
