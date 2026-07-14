import { supabase } from '@/db/supabase';
import type {
  Package, HotspotUser, Payment, Voucher, SupportRequest,
  SystemSetting, SystemStats, RevenueDataPoint,
  PaymentMethodBreakdown, TopPackage, GenerateVoucherRequest,
  Advertisement,
} from '@/types/types';

// ───────────────────────── Packages ─────────────────────────

export async function fetchPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('is_active', true)
    .order('price_ngn', { ascending: true })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchAllPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('price_ngn', { ascending: true })
    .limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertPackage(pkg: Partial<Package>): Promise<void> {
  const { error } = await supabase.from('packages').upsert(pkg);
  if (error) throw error;
}

// ───────────────────────── Hotspot Users ─────────────────────────

export async function fetchHotspotUsers(
  search = '',
  page = 0,
  pageSize = 20
): Promise<{ data: HotspotUser[]; count: number }> {
  let query = supabase
    .from('hotspot_users')
    .select('*', { count: 'exact' });

  if (search) {
    query = query.or(`phone.ilike.%${search}%,mac_address.ilike.%${search}%`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

export async function updateUserStatus(
  id: string,
  status: HotspotUser['status']
): Promise<void> {
  const { error } = await supabase
    .from('hotspot_users')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ───────────────────────── Payments ─────────────────────────

export async function fetchPayments(
  search = '',
  status = '',
  method = '',
  page = 0,
  pageSize = 20
): Promise<{ data: Payment[]; count: number }> {
  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' });

  if (search) query = query.or(`phone.ilike.%${search}%,transaction_id.ilike.%${search}%`);
  if (status) query = query.eq('status', status);
  if (method) query = query.eq('payment_method', method);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

export async function fetchRecentPayments(limit = 10): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ───────────────────────── Analytics ─────────────────────────

export async function fetchSystemStats(): Promise<SystemStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const [thisMonthRes, lastMonthRes, activeUsersRes] = await Promise.all([
    supabase
      .from('payments')
      .select('amount_ngn')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth),
    supabase
      .from('payments')
      .select('amount_ngn')
      .eq('status', 'completed')
      .gte('created_at', startOfLastMonth)
      .lte('created_at', endOfLastMonth),
    supabase
      .from('hotspot_users')
      .select('id', { count: 'exact' })
      .eq('status', 'active'),
  ]);

  const thisRevenue = (thisMonthRes.data ?? []).reduce((s, p) => s + (p.amount_ngn ?? 0), 0);
  const lastRevenue = (lastMonthRes.data ?? []).reduce((s, p) => s + (p.amount_ngn ?? 0), 0);
  const revChangePct = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0;

  return {
    total_revenue: thisRevenue,
    total_transactions: thisMonthRes.data?.length ?? 0,
    active_users: activeUsersRes.count ?? 0,
    active_sessions: activeUsersRes.count ?? 0,
    revenue_change_pct: Math.round(revChangePct * 10) / 10,
    transactions_change_pct: 0,
  };
}

export async function fetchRevenueData(days = 30): Promise<RevenueDataPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('payments')
    .select('amount_ngn, created_at')
    .eq('status', 'completed')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Group by date
  const map: Record<string, { revenue: number; transactions: number }> = {};
  for (const p of data) {
    const d = p.created_at.slice(0, 10);
    if (!map[d]) map[d] = { revenue: 0, transactions: 0 };
    map[d].revenue += p.amount_ngn ?? 0;
    map[d].transactions += 1;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export async function fetchPaymentMethodBreakdown(): Promise<PaymentMethodBreakdown[]> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('payments')
    .select('payment_method, amount_ngn')
    .eq('status', 'completed')
    .gte('created_at', startOfMonth)
    .limit(1000);

  if (error) throw error;
  const map: Record<string, { count: number; revenue: number }> = {};
  for (const p of (data ?? [])) {
    const m = p.payment_method ?? 'unknown';
    if (!map[m]) map[m] = { count: 0, revenue: 0 };
    map[m].count += 1;
    map[m].revenue += p.amount_ngn ?? 0;
  }
  return Object.entries(map).map(([method, v]) => ({ method, ...v }));
}

export async function fetchTopPackages(): Promise<TopPackage[]> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data, error } = await supabase
    .from('payments')
    .select('package_name, amount_ngn')
    .eq('status', 'completed')
    .gte('created_at', startOfMonth)
    .limit(1000);

  if (error) throw error;
  const map: Record<string, { count: number; revenue: number }> = {};
  for (const p of (data ?? [])) {
    const n = p.package_name ?? 'Unknown';
    if (!map[n]) map[n] = { count: 0, revenue: 0 };
    map[n].count += 1;
    map[n].revenue += p.amount_ngn ?? 0;
  }
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ───────────────────────── Vouchers ─────────────────────────

export async function fetchVouchers(
  status = '',
  search = '',
  page = 0,
  pageSize = 20
): Promise<{ data: Voucher[]; count: number }> {
  let query = supabase
    .from('vouchers')
    .select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('code', `%${search}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

export async function generateVouchers(req: GenerateVoucherRequest): Promise<Voucher[]> {
  const { data, error } = await supabase.functions.invoke<Voucher[]>('generate-vouchers', {
    body: req,
    method: 'POST',
  });
  if (error) {
    const msg = await error.context?.text?.();
    throw new Error(msg || error.message);
  }
  return data ?? [];
}

export async function redeemVoucher(
  code: string,
  phone: string,
  mac_address: string
): Promise<{ success: boolean; message: string; expires_at?: string }> {
  const { data, error } = await supabase.functions.invoke<{ success: boolean; message: string; expires_at?: string }>(
    'redeem-voucher',
    { body: { code, phone, mac_address }, method: 'POST' }
  );
  if (error) {
    const msg = await error.context?.text?.();
    throw new Error(msg || error.message);
  }
  return data ?? { success: false, message: 'Unknown error' };
}

export async function retryActivation(
  phone: string,
  mac_address?: string
): Promise<{
  success: boolean;
  message: string;
  already_active?: boolean;
  mikrotik_activated?: boolean;
  expires_at?: string;
}> {
  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    message: string;
    already_active?: boolean;
    mikrotik_activated?: boolean;
    expires_at?: string;
  }>('retry-activation', {
    body: { phone, mac_address: mac_address ?? '' },
    method: 'POST',
  });
  if (error) {
    const msg = await error.context?.text?.();
    throw new Error(msg || error.message);
  }
  return data ?? { success: false, message: 'Unknown error' };
}

// ───────────────────────── Support ─────────────────────────

export async function submitSupportRequest(phone: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('support_requests')
    .insert({ phone, message });
  if (error) throw error;
}

export async function fetchSupportRequests(page = 0, pageSize = 20): Promise<{ data: SupportRequest[]; count: number }> {
  const { data, error, count } = await supabase
    .from('support_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return { data: Array.isArray(data) ? data : [], count: count ?? 0 };
}

// ───────────────────────── Settings ─────────────────────────

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .order('key', { ascending: true })
    .limit(50);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const s of (data ?? []) as SystemSetting[]) map[s.key] = s.value;
  return map;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);
  if (error) throw error;
}

// ───────────────────────── Advertisements ─────────────────────────

export async function fetchActiveAds(): Promise<Advertisement[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchAllAds(): Promise<Advertisement[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .order('display_order', { ascending: true })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function upsertAd(ad: Partial<Advertisement>): Promise<void> {
  const { error } = await supabase.from('advertisements').upsert(ad);
  if (error) throw error;
}

export async function toggleAdActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('advertisements')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAd(id: string): Promise<void> {
  const { error } = await supabase.from('advertisements').delete().eq('id', id);
  if (error) throw error;
}

