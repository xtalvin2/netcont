
-- Completely remove the manually-created broken user
DELETE FROM auth.identities WHERE user_id = '36b3b9b6-18f8-4168-bcbe-97519b393ffd';
DELETE FROM auth.users WHERE id = '36b3b9b6-18f8-4168-bcbe-97519b393ffd';
