-- ============================================================
-- TEMPLATE PREFERENCES MIGRATION
-- Adds cross-device template preference sync to user_settings
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS template_preferences JSONB DEFAULT NULL;

-- template_preferences stores:
-- {
--   "addedIds": ["soap", "psychiatry", ...],   -- which built-in templates the user has in My Templates
--   "customTemplates": [...]                    -- user-created/edited templates
-- }
