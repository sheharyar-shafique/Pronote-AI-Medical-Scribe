-- ============================================================
-- MIGRATION: Remove template CHECK constraint
-- ============================================================
-- The clinical_notes.template column has a CHECK constraint that
-- only allows 8 hardcoded template IDs. The app now has 30+ 
-- built-in templates plus user-created custom templates (custom-*).
-- This migration drops the constraint and widens the column.
-- ============================================================

-- 1. Drop the CHECK constraint on clinical_notes.template
ALTER TABLE clinical_notes DROP CONSTRAINT IF EXISTS clinical_notes_template_check;

-- 2. Widen the column to VARCHAR(100) to accommodate custom-<timestamp> IDs
ALTER TABLE clinical_notes ALTER COLUMN template TYPE VARCHAR(100);

-- 3. Also widen user_settings.default_template in case it has the same limit
ALTER TABLE user_settings ALTER COLUMN default_template TYPE VARCHAR(100);

-- Verify: run this to confirm the constraint is gone
-- SELECT conname FROM pg_constraint WHERE conrelid = 'clinical_notes'::regclass;
