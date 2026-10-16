-- 0027_admin_auth_tables.sql
--
-- Give the admin panel its own identity tables so staff accounts never share the
-- customer `user` / `session` / `account` tables. Until now the admin app's
-- better-auth instance resolved to the default tables, which meant an admin
-- credential was a customer credential. See plan/admin-roles-plan.md (R7).
--
-- Hand-written and applied directly to Neon — the drizzle journal in this repo is
-- already inconsistent (see plan/voice-plan.md §13).

-- ---------------------------------------------------------------------------
-- DDL
-- ---------------------------------------------------------------------------

-- better-auth's `user` model selects `image`; the legacy `admins` table predates
-- that and has no such column.
ALTER TABLE admins ADD COLUMN IF NOT EXISTS image text;

-- `admins.password` was a plaintext NOT NULL column that nothing ever read —
-- better-auth stores the scrypt hash in the account table. Make it nullable so
-- the column can be dropped outright later without another migration.
ALTER TABLE admins ALTER COLUMN password DROP NOT NULL;

-- Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id         text PRIMARY KEY,
  admin_id   text NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions (admin_id);

-- Credential accounts (email/password hash, or future OAuth providers)
CREATE TABLE IF NOT EXISTS admin_accounts (
  id                       text PRIMARY KEY,
  admin_id                 text NOT NULL REFERENCES admins (id) ON DELETE CASCADE,
  account_id               text NOT NULL,
  provider_id              text NOT NULL,
  password                 text,
  access_token             text,
  refresh_token            text,
  id_token                 text,
  access_token_expires_at  timestamp,
  refresh_token_expires_at timestamp,
  scope                    text,
  created_at               timestamp NOT NULL DEFAULT now(),
  updated_at               timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_accounts_admin_idx ON admin_accounts (admin_id);

-- Email verification / password-reset tokens
CREATE TABLE IF NOT EXISTS admin_verifications (
  id         text PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_verifications_identifier_idx
  ON admin_verifications (identifier);