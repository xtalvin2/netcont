
UPDATE auth.users
SET
  encrypted_password = crypt('Netconnect2025', gen_salt('bf')),
  updated_at = now()
WHERE email = 'admin@netconnect.ng';
