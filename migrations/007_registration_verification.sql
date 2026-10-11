BEGIN;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN email_verified_address text;
CREATE TABLE pending_registrations (
    token_hash text PRIMARY KEY,
    username text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    code_hash text,
    code_expires_at timestamptz,
    last_sent_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX pending_registrations_expiry_idx ON pending_registrations(expires_at);
CREATE TABLE registration_rate_limits (
    bucket text PRIMARY KEY,
    started_at timestamptz NOT NULL,
    attempts integer NOT NULL
);
COMMIT;
