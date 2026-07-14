import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ATTEMPTS = 5; // hard cap per payment

// ── MikroTik relay helper (same pattern as redeem-voucher) ────────────────────
async function mikrotikActivate(params: {
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
      headers: { 'Content-Type': 'application/json', 'x-relay-secret': relaySecret },
      body: JSON.stringify({
        userId: '',          // no voucher user to disable — payment-based activation
        macAddress: params.macAddress,
        profile: params.profile,
        limitUptime: params.limitUptime,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn('MikroTik relay error (non-fatal):', err);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { phone, mac_address } = await req.json();

    if (!phone || !phone.trim()) {
      return json({ success: false, message: 'Phone number is required.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const cleanPhone = phone.trim();
    const cleanMac = mac_address?.trim() || null;

    // ── STEP 1: Find the most recent completed, non-expired payment ───────────
    // Search by phone first; if mac_address provided also try that as fallback.
    let payment: Record<string, unknown> | null = null;

    const byPhone = await supabase
      .from('payments')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('status', 'completed')
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    payment = byPhone.data;

    if (!payment && cleanMac) {
      const byMac = await supabase
        .from('payments')
        .select('*')
        .eq('mac_address', cleanMac)
        .eq('status', 'completed')
        .gt('expires_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = byMac.data;
    }

    if (!payment) {
      return json({
        success: false,
        message: 'No active payment found for this phone number. Please check the number or make a new payment.',
      });
    }

    const paymentId  = payment.id as string;
    const expiresAt  = payment.expires_at as string;
    const pkgName    = (payment.package_name as string) ?? 'default';
    const macToUse   = cleanMac || (payment.mac_address as string) || null;

    // ── STEP 2: Anti-double-access — check if already fully active ────────────
    if (payment.mikrotik_activated) {
      // Check hotspot_users to see if session is actually live
      const { data: activeUser } = await supabase
        .from('hotspot_users')
        .select('id, status, expires_at')
        .eq('mac_address', macToUse ?? '')
        .eq('status', 'active')
        .gt('expires_at', now.toISOString())
        .maybeSingle();

      if (activeUser) {
        // Already active and connected — don't push again
        return json({
          success: true,
          already_active: true,
          message: 'Your session is already active! Try disconnecting and reconnecting to the WiFi network.',
          expires_at: expiresAt,
        });
      }

      // mikrotik_activated=true but hotspot_users shows inactive → MAC may have changed
      // or MikroTik lost its state. Re-push is safe — we use the ORIGINAL expiry (no extension).
      console.log(`Payment ${paymentId} was activated before but session inactive — re-pushing to MikroTik`);
    }

    // ── STEP 3: Attempt cap — max MAX_ATTEMPTS total per payment ──────────────
    const attempts = (payment.activation_attempts as number) ?? 0;
    if (attempts >= MAX_ATTEMPTS) {
      return json({
        success: false,
        message: `Maximum activation attempts reached for this payment. Please contact support with your phone number: ${cleanPhone}.`,
      });
    }

    // ── STEP 4: Upsert hotspot_users (DB record — always succeeds) ────────────
    if (macToUse) {
      await supabase.from('hotspot_users').upsert({
        phone: cleanPhone,
        mac_address: macToUse,
        status: 'active',
        current_package_id: payment.package_id as string ?? null,
        expires_at: expiresAt,           // ORIGINAL expiry — no extension
        last_seen: now.toISOString(),
      }, { onConflict: 'mac_address' });
    }

    // ── STEP 5: Call MikroTik relay ───────────────────────────────────────────
    const relayConfigured = !!Deno.env.get('MIKROTIK_RELAY_URL');
    let mikrotikOk = false;

    if (relayConfigured && macToUse) {
      // Derive uptime string from remaining time (never exceed original expiry)
      const remaining = Math.max(0, (new Date(expiresAt).getTime() - now.getTime()) / 1000 / 60);
      const uptimeStr = `${Math.ceil(remaining)}m`;
      mikrotikOk = await mikrotikActivate({
        macAddress: macToUse,
        profile: pkgName,
        limitUptime: uptimeStr,
      });
    }

    // ── STEP 6: Update payment record ────────────────────────────────────────
    await supabase.from('payments').update({
      mikrotik_activated: mikrotikOk || (payment.mikrotik_activated as boolean) || false,
      activation_attempts: attempts + 1,
      last_activation_at: now.toISOString(),
    }).eq('id', paymentId);

    // ── STEP 7: Update / remove pending_activations queue entry ──────────────
    if (mikrotikOk) {
      // Mark as activated so the cron job skips it
      await supabase.from('pending_activations')
        .update({ status: 'activated', last_attempt_at: now.toISOString() })
        .eq('payment_id', paymentId);
    } else if (!payment.mikrotik_activated) {
      // Ensure there's a pending entry for the cron to pick up
      await supabase.from('pending_activations').upsert({
        payment_id: paymentId,
        phone: cleanPhone,
        mac_address: macToUse,
        package_name: pkgName,
        expires_at: expiresAt,
        attempts: attempts + 1,
        last_attempt_at: now.toISOString(),
        status: 'pending',
      }, { onConflict: 'payment_id' });
    }

    return json({
      success: true,
      already_active: false,
      mikrotik_activated: mikrotikOk,
      message: mikrotikOk
        ? `Connected! Your session is active until ${new Date(expiresAt).toLocaleString('en-NG')}.`
        : macToUse
          ? 'Your session has been recorded. Connect to the WiFi network — you should have access within 5 minutes.'
          : 'Payment confirmed. Please connect to the WiFi network with your device and you should get access.',
      expires_at: expiresAt,
    });

  } catch (err) {
    console.error('retry-activation error:', err);
    return json({ success: false, message: 'Internal server error. Please try again.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
