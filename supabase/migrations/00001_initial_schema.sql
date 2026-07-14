
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Packages table
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_hours INT NOT NULL,
  price_ngn INT NOT NULL,
  speed_mbps INT NOT NULL,
  data_limit TEXT NOT NULL DEFAULT 'Unlimited',
  features TEXT[] NOT NULL DEFAULT '{}',
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users table (hotspot users, not admin accounts)
CREATE TABLE hotspot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  mac_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','blocked')),
  current_package_id UUID REFERENCES packages(id),
  expires_at TIMESTAMPTZ,
  total_spent_ngn INT NOT NULL DEFAULT 0,
  sessions_count INT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES hotspot_users(id),
  phone TEXT NOT NULL,
  amount_ngn INT NOT NULL,
  package_id UUID REFERENCES packages(id),
  package_name TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  paystack_ref TEXT,
  mac_address TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'card' CHECK (payment_method IN ('card','bank_transfer','ussd','voucher')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vouchers table
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  package_id UUID REFERENCES packages(id),
  package_name TEXT NOT NULL,
  validity_hours INT NOT NULL,
  price_ngn INT NOT NULL,
  reseller_price_ngn INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  redeemed_by_phone TEXT,
  redeemed_by_mac TEXT,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  batch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support requests
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System settings
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_phone ON payments(phone);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_hotspot_users_phone ON hotspot_users(phone);
CREATE INDEX idx_hotspot_users_status ON hotspot_users(status);

-- =====================
-- RLS
-- =====================
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Packages: public read, service-role write
CREATE POLICY "packages_public_read" ON packages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "packages_service_write" ON packages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Hotspot users: service role only
CREATE POLICY "hotspot_users_service_all" ON hotspot_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "hotspot_users_anon_read_own" ON hotspot_users FOR SELECT TO anon USING (true);

-- Payments: anon insert (for payment initiation), service role all
CREATE POLICY "payments_service_all" ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "payments_anon_insert" ON payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "payments_anon_read_own" ON payments FOR SELECT TO anon USING (true);

-- Vouchers: anon read active only, service role all
CREATE POLICY "vouchers_service_all" ON vouchers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vouchers_anon_read_active" ON vouchers FOR SELECT TO anon USING (status = 'active');

-- Support requests: anon insert
CREATE POLICY "support_anon_insert" ON support_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "support_service_all" ON support_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- System settings: service role only
CREATE POLICY "settings_service_all" ON system_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "settings_anon_read" ON system_settings FOR SELECT TO anon USING (true);

-- =====================
-- SEED DATA
-- =====================

-- Default packages
INSERT INTO packages (name, duration_hours, price_ngn, speed_mbps, data_limit, features, is_popular, is_active) VALUES
('Quick Browse', 1, 200, 2, 'Unlimited', ARRAY['Basic browsing', 'Social media', 'Email access', 'Standard support'], false, true),
('Work Session', 4, 500, 3, 'Unlimited', ARRAY['Video calls', 'File downloads', 'SD Streaming', 'Priority support'], false, true),
('Half Day', 12, 800, 4, 'Unlimited', ARRAY['HD streaming', 'Large downloads', 'Gaming', '24/7 support'], false, true),
('Full Day', 24, 1200, 5, 'Unlimited', ARRAY['Ultra-fast browsing', '4K streaming', 'Unlimited downloads', 'Premium support'], true, true);

-- Default system settings
INSERT INTO system_settings (key, value) VALUES
('paystack_public_key', ''),
('mikrotik_ip', '192.168.88.1'),
('mikrotik_username', 'admin'),
('hotspot_name', 'MyHotspot'),
('business_name', 'NetConnect Nigeria'),
('support_phone', '08000000000');
