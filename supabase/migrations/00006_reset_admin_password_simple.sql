
-- Delete and recreate admin user cleanly with simple credentials
DELETE FROM auth.identities WHERE user_id = '36b3b9b6-18f8-4168-bcbe-97519b393ffd';
DELETE FROM auth.users WHERE id = '36b3b9b6-18f8-4168-bcbe-97519b393ffd';

-- Insert fresh user with email: admin and password: admin
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role
) VALUES (
  '36b3b9b6-18f8-4168-bcbe-97519b393ffd',
  '00000000-0000-0000-0000-000000000000',
  'admin@netconnect.ng',
  crypt('admin', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"NetConnect Admin"}'::jsonb,
  false,
  'authenticated'
);

INSERT INTO auth.identities (
  id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at, provider_id
) VALUES (
  gen_random_uuid(),
  '36b3b9b6-18f8-4168-bcbe-97519b393ffd',
  '{"sub":"36b3b9b6-18f8-4168-bcbe-97519b393ffd","email":"admin@netconnect.ng"}'::jsonb,
  'email',
  now(), now(), now(),
  'admin@netconnect.ng'
);
