
INSERT INTO system_settings (key, value)
VALUES
  ('paystack_secret_key', ''),
  ('mikrotik_password', '')
ON CONFLICT (key) DO NOTHING;
