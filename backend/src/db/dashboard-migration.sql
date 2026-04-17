-- Dashboard Data Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- ADD PROCESSING TIME TO CLINICAL NOTES
-- ============================================
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS processing_time_seconds INTEGER DEFAULT NULL;

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  patient_id VARCHAR(255),
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  appointment_type VARCHAR(100) NOT NULL DEFAULT 'General',
  duration_minutes INTEGER DEFAULT 30,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NOTE FEEDBACK TABLE (for accuracy tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS note_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES clinical_notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_note_feedback_note_id ON note_feedback(note_id);
CREATE INDEX IF NOT EXISTS idx_note_feedback_user_id ON note_feedback(user_id);

-- ============================================
-- TRIGGER FOR APPOINTMENTS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_appointments_updated_at') THEN
    CREATE TRIGGER update_appointments_updated_at
      BEFORE UPDATE ON appointments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- SAMPLE APPOINTMENTS (Optional - for testing)
-- ============================================
-- INSERT INTO appointments (user_id, patient_name, appointment_time, appointment_type, status)
-- SELECT id, 'John Smith', NOW() + INTERVAL '1 hour', 'Follow-up', 'scheduled' FROM users LIMIT 1;
