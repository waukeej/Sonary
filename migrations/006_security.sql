BEGIN;
CREATE TABLE user_security (
    user_id integer PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    two_factor_enabled boolean NOT NULL DEFAULT false,
    primary_2fa_method text CHECK (primary_2fa_method IN ('email', 'totp', 'telegram')),
    email_enabled boolean NOT NULL DEFAULT false,
    verified_email text,
    totp_secret text,
    last_totp_step bigint NOT NULL DEFAULT -1,
    revision integer NOT NULL DEFAULT 0,
    failures integer NOT NULL DEFAULT 0,
    locked_until timestamptz,
    last_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT two_factor_enabled OR primary_2fa_method IS NOT NULL)
);
CREATE TABLE security_challenges (
    token_hash text PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('login', 'setup', 'reauth')),
    method text NOT NULL CHECK (method IN ('email', 'totp')),
    code_hash text,
    pending_secret text,
    email text NOT NULL,
    revision integer NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX security_challenges_user_idx ON security_challenges(user_id);
CREATE TABLE security_recovery_codes (
    user_id integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    code_hash text NOT NULL,
    PRIMARY KEY (user_id, code_hash)
);
COMMIT;
