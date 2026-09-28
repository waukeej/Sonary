BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio varchar(1000) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS city varchar(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_filename varchar(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility varchar(7) NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'private'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
COMMIT;
