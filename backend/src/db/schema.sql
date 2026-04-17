-- Pronote Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'clinician' CHECK (role IN ('clinician', 'admin')),
  specialty VARCHAR(255),
  avatar_url TEXT,
  subscription_status VARCHAR(50) DEFAULT 'trial' CHECK (subscription_status IN ('active', 'inactive', 'trial')),
  subscription_plan VARCHAR(50) CHECK (subscription_plan IN ('starter', 'practice', 'enterprise')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('starter', 'practice', 'enterprise')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CLINICAL NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_name VARCHAR(255) NOT NULL,
  patient_id VARCHAR(255),
  date_of_service DATE NOT NULL DEFAULT CURRENT_DATE,
  template VARCHAR(50) NOT NULL CHECK (template IN ('soap', 'psychiatry', 'therapy', 'pediatrics', 'cardiology', 'dermatology', 'orthopedics', 'custom')),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'signed')),
  audio_url TEXT,
  transcription TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NOTE CONTENT TABLE (structured content)
-- ============================================
CREATE TABLE IF NOT EXISTS note_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID REFERENCES clinical_notes(id) ON DELETE CASCADE UNIQUE,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  chief_complaint TEXT,
  history_of_present_illness TEXT,
  review_of_systems TEXT,
  physical_exam TEXT,
  medical_decision_making TEXT,
  instructions TEXT,
  follow_up TEXT,
  custom_sections JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TEMPLATES TABLE (custom templates)
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  specialty VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AUDIO FILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audio_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES clinical_notes(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  transcription_status VARCHAR(50) DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  default_template VARCHAR(50) DEFAULT 'soap',
  auto_save BOOLEAN DEFAULT TRUE,
  dark_mode BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  audio_quality VARCHAR(50) DEFAULT 'high',
  language VARCHAR(10) DEFAULT 'en-US',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOG TABLE (for admin dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_user_id ON clinical_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_status ON clinical_notes(status);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_date_of_service ON clinical_notes(date_of_service);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_user_id ON audio_files(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================
-- UPDATE TIMESTAMP FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_clinical_notes_updated_at') THEN
    CREATE TRIGGER update_clinical_notes_updated_at
      BEFORE UPDATE ON clinical_notes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_note_contents_updated_at') THEN
    CREATE TRIGGER update_note_contents_updated_at
      BEFORE UPDATE ON note_contents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at') THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_settings_updated_at') THEN
    CREATE TRIGGER update_user_settings_updated_at
      BEFORE UPDATE ON user_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_templates_updated_at') THEN
    CREATE TRIGGER update_templates_updated_at
      BEFORE UPDATE ON templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_self_policy' AND tablename = 'users') THEN
    CREATE POLICY users_self_policy ON users
      FOR ALL USING (id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notes_owner_policy' AND tablename = 'clinical_notes') THEN
    CREATE POLICY notes_owner_policy ON clinical_notes
      FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'note_contents_owner_policy' AND tablename = 'note_contents') THEN
    CREATE POLICY note_contents_owner_policy ON note_contents
      FOR ALL USING (note_id IN (SELECT id FROM clinical_notes WHERE user_id = auth.uid()) 
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_owner_policy' AND tablename = 'subscriptions') THEN
    CREATE POLICY subscriptions_owner_policy ON subscriptions
      FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'templates_owner_policy' AND tablename = 'templates') THEN
    CREATE POLICY templates_owner_policy ON templates
      FOR ALL USING (user_id = auth.uid() OR is_default = TRUE 
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audio_files_owner_policy' AND tablename = 'audio_files') THEN
    CREATE POLICY audio_files_owner_policy ON audio_files
      FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_settings_owner_policy' AND tablename = 'user_settings') THEN
    CREATE POLICY user_settings_owner_policy ON user_settings
      FOR ALL USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'activity_logs_admin_policy' AND tablename = 'activity_logs') THEN
    CREATE POLICY activity_logs_admin_policy ON activity_logs
      FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ============================================
-- INSERT DEFAULT TEMPLATES
-- ============================================
INSERT INTO templates (id, name, description, template_type, sections, specialty, is_default) VALUES
  (uuid_generate_v4(), 'SOAP Note', 'Standard Subjective, Objective, Assessment, Plan format', 'soap', '["Subjective", "Objective", "Assessment", "Plan"]', 'General', TRUE),
  (uuid_generate_v4(), 'Psychiatry Note', 'Comprehensive psychiatric evaluation template', 'psychiatry', '["Chief Complaint", "History of Present Illness", "Mental Status Exam", "Assessment", "Plan"]', 'Psychiatry', TRUE),
  (uuid_generate_v4(), 'Therapy Note', 'Psychotherapy session documentation', 'therapy', '["Session Summary", "Interventions", "Client Response", "Progress", "Plan"]', 'Therapy', TRUE),
  (uuid_generate_v4(), 'Pediatrics Note', 'Child-focused clinical documentation', 'pediatrics', '["Chief Complaint", "History", "Growth & Development", "Physical Exam", "Assessment", "Plan"]', 'Pediatrics', TRUE),
  (uuid_generate_v4(), 'Cardiology Note', 'Cardiovascular evaluation template', 'cardiology', '["Chief Complaint", "Cardiac History", "Physical Exam", "ECG/Imaging", "Assessment", "Plan"]', 'Cardiology', TRUE),
  (uuid_generate_v4(), 'Dermatology Note', 'Skin condition documentation', 'dermatology', '["Chief Complaint", "Skin Exam", "Lesion Description", "Assessment", "Plan"]', 'Dermatology', TRUE),
  (uuid_generate_v4(), 'Orthopedics Note', 'Musculoskeletal evaluation template', 'orthopedics', '["Chief Complaint", "Mechanism of Injury", "Physical Exam", "Imaging", "Assessment", "Plan"]', 'Orthopedics', TRUE)
ON CONFLICT DO NOTHING;
