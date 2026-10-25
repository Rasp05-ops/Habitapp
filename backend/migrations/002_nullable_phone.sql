-- Password accounts have no phone number. Preserve uniqueness for OTP phone accounts only.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
UPDATE users SET phone = NULL WHERE phone = '';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_unique ON users (phone) WHERE phone IS NOT NULL;
