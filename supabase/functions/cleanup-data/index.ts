import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * cleanup-data — Daily data hygiene function.
 *
 * Called by:
 *   1. pg_cron daily schedule (automatic)
 *   2. Admin dashboard "Clear Old Data" button (manual)
 *
 * Deletes:
 *   - hotspot_users  : expired sessions older than 7 days
 *   - payments       : completed/failed records older than 90 days
 *   - vouchers       : redeemed vouchers older than 30 days
 *   - pending_activations : failed/stuck records older than 15 days
 *
 * Accepts optional body: { preview: true } — returns counts WITHOUT deleting.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse request body safely
    let preview = false;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        preview = body?.preview === true;
      } catch { /* no body or not JSON */ }
    }

    const now = new Date();

    // Cutoff timestamps
    const cutoff7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff15d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();

    if (preview) {
      // COUNT only — do not delete anything
      const [hu, pay, vou, pa] = await Promise.all([
        supabase.from('hotspot_users')
          .select('id', { count: 'exact', head: true })
          .in('status', ['inactive', 'expired'])
          .lt('created_at', cutoff7d),

        supabase.from('payments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['completed', 'failed'])
          .lt('created_at', cutoff90d),

        supabase.from('vouchers')
          .select('id', { count: 'exact', head: true })
          .eq('redeemed', true)
          .lt('created_at', cutoff30d),

        supabase.from('pending_activations')
          .select('id', { count: 'exact', head: true })
          .in('status', ['failed', 'expired'])
          .lt('created_at', cutoff15d),
      ]);

      return new Response(JSON.stringify({
        preview: true,
        counts: {
          hotspot_users:        hu.count  ?? 0,
          payments:             pay.count ?? 0,
          vouchers:             vou.count ?? 0,
          pending_activations:  pa.count  ?? 0,
        },
        cutoffs: { '7_days': cutoff7d, '30_days': cutoff30d, '90_days': cutoff90d, '15_days': cutoff15d },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTUAL CLEANUP ──────────────────────────────────────────────────

    // 1. Delete expired/inactive hotspot users older than 7 days
    const { count: deletedUsers, error: userErr } = await supabase
      .from('hotspot_users')
      .delete({ count: 'exact' })
      .in('status', ['inactive', 'expired'])
      .lt('created_at', cutoff7d);
    if (userErr) console.error('cleanup hotspot_users error:', userErr);

    // 2. Delete completed/failed payments older than 90 days
    const { count: deletedPayments, error: payErr } = await supabase
      .from('payments')
      .delete({ count: 'exact' })
      .in('status', ['completed', 'failed'])
      .lt('created_at', cutoff90d);
    if (payErr) console.error('cleanup payments error:', payErr);

    // 3. Delete redeemed vouchers older than 30 days
    const { count: deletedVouchers, error: vouchErr } = await supabase
      .from('vouchers')
      .delete({ count: 'exact' })
      .eq('redeemed', true)
      .lt('created_at', cutoff30d);
    if (vouchErr) console.error('cleanup vouchers error:', vouchErr);

    // 4. Delete failed/stuck pending_activations older than 15 days
    const { count: deletedActivations, error: paErr } = await supabase
      .from('pending_activations')
      .delete({ count: 'exact' })
      .in('status', ['failed', 'expired'])
      .lt('created_at', cutoff15d);
    if (paErr) console.error('cleanup pending_activations error:', paErr);

    const summary = {
      ran_at: now.toISOString(),
      deleted: {
        hotspot_users:       deletedUsers       ?? 0,
        payments:            deletedPayments    ?? 0,
        vouchers:            deletedVouchers    ?? 0,
        pending_activations: deletedActivations ?? 0,
      },
    };

    console.log('cleanup-data completed:', JSON.stringify(summary));

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('cleanup-data error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
