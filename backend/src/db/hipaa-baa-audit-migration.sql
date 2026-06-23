-- HIPAA BAA acceptance audit columns
--
-- The /api/support/accept-baa endpoint now records *who, when, from where, and
-- which version of the BAA* on every acceptance. The first three columns
-- (hipaa_baa_accepted, hipaa_baa_accepted_at, hipaa_baa_organization,
-- hipaa_baa_signer_title) already existed; this migration adds the rest.
--
-- Run once in the Supabase SQL editor against the production database.
-- Idempotent — safe to run multiple times (uses IF NOT EXISTS).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hipaa_baa_version     VARCHAR(64),
  ADD COLUMN IF NOT EXISTS hipaa_baa_ip_address  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS hipaa_baa_user_agent  TEXT;

-- Comments — visible in Supabase's table view, useful for future devs and auditors.
COMMENT ON COLUMN users.hipaa_baa_version
  IS 'Version identifier of the BAA template the user agreed to (e.g. 2026-05-06.v1). Bump when BAA text changes; existing acceptances retain their original version.';
COMMENT ON COLUMN users.hipaa_baa_ip_address
  IS 'IP address from which the BAA was accepted. Required for HIPAA tamper-evident audit trail.';
COMMENT ON COLUMN users.hipaa_baa_user_agent
  IS 'Browser / client user agent string at time of BAA acceptance. Required for HIPAA tamper-evident audit trail.';

-- Index the BAA-accepted flag for compliance reports ("show me every signed BAA").
CREATE INDEX IF NOT EXISTS idx_users_hipaa_baa_accepted
  ON users (hipaa_baa_accepted)
  WHERE hipaa_baa_accepted = TRUE;
