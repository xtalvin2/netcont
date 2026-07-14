export interface Package {
  id: string;
  name: string;
  duration_hours: number;
  price_ngn: number;
  speed_mbps: number;
  data_limit: string;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  created_at: string;
}

export interface HotspotUser {
  id: string;
  phone: string;
  mac_address: string;
  status: 'active' | 'inactive' | 'blocked';
  current_package_id: string | null;
  expires_at: string | null;
  total_spent_ngn: number;
  sessions_count: number;
  last_seen: string | null;
  created_at: string;
  // joined
  current_package?: Package;
}

export interface Payment {
  id: string;
  user_id: string | null;
  phone: string;
  amount_ngn: number;
  package_id: string | null;
  package_name: string;
  transaction_id: string;
  paystack_ref: string | null;
  mac_address: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method: 'card' | 'bank_transfer' | 'ussd' | 'voucher';
  expires_at: string | null;
  created_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  package_id: string | null;
  package_name: string;
  validity_hours: number;
  price_ngn: number;
  reseller_price_ngn: number | null;
  status: 'active' | 'used' | 'expired';
  redeemed_by_phone: string | null;
  redeemed_by_mac: string | null;
  redeemed_at: string | null;
  expires_at: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface SupportRequest {
  id: string;
  phone: string;
  message: string;
  status: 'open' | 'resolved';
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface SystemStats {
  total_revenue: number;
  total_transactions: number;
  active_users: number;
  active_sessions: number;
  revenue_change_pct: number;
  transactions_change_pct: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  transactions: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  revenue: number;
}

export interface TopPackage {
  name: string;
  count: number;
  revenue: number;
}

export interface Advertisement {
  id: string;
  title: string;
  type: 'image' | 'video' | 'url';
  content_url: string | null;
  link_url: string | null;
  caption: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateVoucherRequest {
  package_id: string;
  quantity: number;
  price_ngn: number;
  reseller_price_ngn?: number;
  expires_at?: string;
}

export interface PaystackInitRequest {
  phone: string;
  amount_ngn: number;
  package_id: string;
  mac_address: string;
  email?: string;
}

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
  transaction_id: string;
}
