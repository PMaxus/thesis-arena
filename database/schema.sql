CREATE SCHEMA IF NOT EXISTS thesis_arena;

CREATE TABLE IF NOT EXISTS thesis_arena.runs (
  execution_id text PRIMARY KEY,
  account_username text,
  thesis text NOT NULL,
  language varchar(16) NOT NULL DEFAULT 'en',
  status text NOT NULL,
  stage text NOT NULL,
  analysis_model text,
  fact_check_model text,
  success boolean,
  error text,
  payload jsonb,
  duration_ms bigint,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_updated_at_idx
  ON thesis_arena.runs (updated_at DESC);

CREATE INDEX IF NOT EXISTS runs_account_username_idx
  ON thesis_arena.runs (account_username);

CREATE TABLE IF NOT EXISTS thesis_arena.access_accounts (
  username text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('master', 'guest')),
  quota integer CHECK (quota IS NULL OR quota >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS access_accounts_enabled_idx
  ON thesis_arena.access_accounts (enabled);

COMMENT ON COLUMN thesis_arena.access_accounts.quota IS
  'NULL means unlimited. Authentication secrets are intentionally stored outside PostgreSQL.';
