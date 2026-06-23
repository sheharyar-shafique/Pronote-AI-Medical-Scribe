-- ============================================================
-- PRONOTE UPDATE MIGRATION
-- Safe to run on existing database - only adds missing items
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add PayPal column to users (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'paypal_subscription_id') THEN
    ALTER TABLE users ADD COLUMN paypal_subscription_id VARCHAR(255);
  END IF;
END $$;

-- Add processing_time_seconds to clinical_notes (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinical_notes' AND column_name = 'processing_time_seconds') THEN
    ALTER TABLE clinical_notes ADD COLUMN processing_time_seconds INTEGER DEFAULT NULL;
  END IF;
END $$;

-- Add PayPal columns to subscriptions (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'paypal_subscription_id') THEN
    ALTER TABLE subscriptions ADD COLUMN paypal_subscription_id VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'payment_provider') THEN
    ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(50) DEFAULT 'stripe';
  END IF;
END $$;

-- ============================================
-- CREATE NEW TABLES (IF NOT EXISTS)
-- ============================================

-- 8. APPOINTMENTS TABLE
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

-- 9. NOTE FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS note_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES clinical_notes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  payment_provider VARCHAR(50) NOT NULL CHECK (payment_provider IN ('stripe', 'paypal')),
  payment_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREATE NEW INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_clinical_notes_created_at ON clinical_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_id ON subscriptions(paypal_subscription_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_note_feedback_note_id ON note_feedback(note_id);
CREATE INDEX IF NOT EXISTS idx_note_feedback_user_id ON note_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- ============================================
-- CREATE TRIGGER FOR APPOINTMENTS
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
-- ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DONE! Migration complete.
-- ============================================
SELECT 'Migration completed successfully!' as status;
