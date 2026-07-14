
-- Ensure default system settings rows exist for all keys used in the settings page
INSERT INTO system_settings (key, value)
VALUES
  ('business_name', 'NetConnect Nigeria'),
  ('support_phone', '08000000000'),
  ('hotspot_name', 'NetConnect'),
  ('paystack_public_key', ''),
  ('mikrotik_ip', '192.168.88.1'),
  ('mikrotik_username', 'admin')
ON CONFLICT (key) DO NOTHING;

-- Add index on vouchers.code for fast lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);

-- Add index on payments.paystack_ref for webhook lookups
CREATE INDEX IF NOT EXISTS idx_payments_paystack_ref ON payments(paystack_ref);

-- Add index on hotspot_users.mac_address for whitelist upserts
CREATE INDEX IF NOT EXISTS idx_hotspot_users_mac ON hotspot_users(mac_address);

-- Add index on payments.created_at for analytics queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
