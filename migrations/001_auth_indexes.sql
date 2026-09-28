BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_unique ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_unique ON users (lower(email));
COMMIT;

