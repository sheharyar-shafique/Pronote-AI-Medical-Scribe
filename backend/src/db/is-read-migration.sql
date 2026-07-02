-- Migration: Add is_read column to clinical_notes
-- This enables proper read/unread tracking for the notes list panel.

-- Add the column (defaults to FALSE so all existing notes start as unread)
ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient filtering of unread notes per user
CREATE INDEX IF NOT EXISTS idx_clinical_notes_user_is_read
  ON clinical_notes (user_id, is_read)
  WHERE is_read = FALSE;
