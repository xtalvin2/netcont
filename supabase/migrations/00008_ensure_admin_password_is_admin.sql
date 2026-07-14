
UPDATE auth.users
SET encrypted_password = crypt('admin', gen_salt('bf')), updated_at = now()
WHERE email = 'admin@admin.com';
