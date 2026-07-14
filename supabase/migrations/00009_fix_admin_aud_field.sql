
UPDATE auth.users
SET
  aud = 'authenticated',
  instance_id = '00000000-0000-0000-0000-000000000000',
  encrypted_password = crypt('admin', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'admin@admin.com';
