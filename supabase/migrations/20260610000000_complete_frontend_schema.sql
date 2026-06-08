-- Complete Database Schema aligned with Frontend Requirements
-- This migration creates all tables, enums, and RLS policies needed by the application

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE user_role_enum AS ENUM ('admin', 'staff', 'student');
CREATE TYPE enrollment_type_enum AS ENUM ('free', 'paid', 'scholarship');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE test_type_enum AS ENUM ('normal', 'pdf');
CREATE TYPE question_type_enum AS ENUM ('multiple_choice', 'integer', 'numerical', 'text', 'image', 'match', 'fill_blanks');
CREATE TYPE dpp_difficulty_enum AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE monitoring_event_type_enum AS ENUM ('consent_accepted', 'session_started', 'permission_state', 'fullscreen_exit', 'tab_switch', 'copy_paste', 'unusual_activity', 'session_ended');
CREATE TYPE monitoring_alert_severity_enum AS ENUM ('info', 'warning', 'critical');
CREATE TYPE notification_type_enum AS ENUM ('test_available', 'test_starting', 'result_available', 'admin_alert');
CREATE TYPE payment_type_enum AS ENUM ('enrollment', 'subscription', 'course');

-- ==========================================
-- CORE USER & PROFILE TABLES
-- ==========================================

-- Users (managed by Supabase Auth)
-- This table extends auth.users with additional profile info
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  roll_number TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  institution_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles (extending Supabase Auth)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role user_role_enum DEFAULT 'student',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_roles_unique UNIQUE (user_id)
);

-- Institutions for multi-org support
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Institution members (staff/admins per institution)
CREATE TABLE IF NOT EXISTS institution_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_enum DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT institution_members_unique UNIQUE (institution_id, user_id)
);

-- Departments within institutions
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- COURSE & QUESTION MANAGEMENT
-- ==========================================

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chapters within courses
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question bank (library questions)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  options JSONB, -- Array of options for MCQ
  correct_answer JSONB, -- Can be single value or array
  question_type question_type_enum DEFAULT 'multiple_choice',
  difficulty dpp_difficulty_enum,
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  image_url TEXT,
  image_urls TEXT[], -- Multiple images
  explanation TEXT,
  topic TEXT,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query builder questions (dynamic/customizable questions)
CREATE TABLE IF NOT EXISTS qb_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qb_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qb_course_id UUID NOT NULL REFERENCES qb_courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qb_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qb_chapter_id UUID REFERENCES qb_chapters(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  question_type question_type_enum DEFAULT 'multiple_choice',
  difficulty dpp_difficulty_enum,
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  image_url TEXT,
  explanation TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qb_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qb_question_id UUID NOT NULL REFERENCES qb_questions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT qb_bookmarks_unique UNIQUE (user_id, qb_question_id)
);

-- Question bookmarks (from question bank)
CREATE TABLE IF NOT EXISTS question_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT question_bookmarks_unique UNIQUE (user_id, question_id)
);

-- PhyNetix library (imported questions)
CREATE TABLE IF NOT EXISTS phynetix_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  question_type question_type_enum DEFAULT 'multiple_choice',
  difficulty dpp_difficulty_enum,
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  image_url TEXT,
  image_urls TEXT[],
  explanation TEXT,
  topic TEXT,
  subject TEXT,
  chapter TEXT,
  course TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- BATCH & ENROLLMENT MANAGEMENT
-- ==========================================

-- Batches (groups of students)
CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch enrollments
CREATE TABLE IF NOT EXISTS batch_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_type enrollment_type_enum DEFAULT 'free',
  payment_status payment_status_enum DEFAULT 'completed',
  is_active BOOLEAN DEFAULT TRUE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT batch_enrollments_unique UNIQUE (batch_id, user_id)
);

-- Batch-wise tests (tests assigned to batches)
CREATE TABLE IF NOT EXISTS batch_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  unlock_date TIMESTAMP WITH TIME ZONE,
  is_bonus BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT batch_tests_unique UNIQUE (batch_id, test_id)
);

-- Staff requests (enrollment requests needing approval)
CREATE TABLE IF NOT EXISTS staff_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- TEST MANAGEMENT
-- ==========================================

-- Tests
CREATE TABLE IF NOT EXISTS tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 60,
  total_marks INTEGER,
  test_type test_type_enum DEFAULT 'normal',
  exam_type TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  show_solutions BOOLEAN DEFAULT TRUE,
  result_release_delay_minutes INTEGER DEFAULT 0,
  pdf_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test subjects (for section-based tests)
CREATE TABLE IF NOT EXISTS test_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test sections (for section-based tests)
CREATE TABLE IF NOT EXISTS test_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  test_subject_id UUID REFERENCES test_subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section_type TEXT, -- 'multiple_choice', 'integer', etc.
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test section questions (questions in section-based tests)
CREATE TABLE IF NOT EXISTS test_section_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  test_section_id UUID NOT NULL REFERENCES test_sections(id) ON DELETE CASCADE,
  question_number INTEGER,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB,
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  is_bonus BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  image_urls TEXT[],
  paragraph_id UUID, -- For linked paragraphs
  pdf_page INTEGER,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question paragraphs (comprehension passages for section-based tests)
CREATE TABLE IF NOT EXISTS question_paragraphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  paragraph_text TEXT NOT NULL,
  image_url TEXT,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test questions (for normal/traditional tests)
CREATE TABLE IF NOT EXISTS test_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT test_questions_unique UNIQUE (test_id, question_id)
);

-- Test attempts (student attempts at tests)
CREATE TABLE IF NOT EXISTS test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_submitted_at TIMESTAMP WITH TIME ZONE,
  score NUMERIC(10, 2),
  total_marks INTEGER,
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '{}', -- User answers
  rank INTEGER,
  percentile NUMERIC(5, 2),
  submit_disabled BOOLEAN DEFAULT FALSE,
  extra_time_minutes INTEGER DEFAULT 0,
  result_release_delay_minutes INTEGER DEFAULT 0,
  result_available_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test user overrides (custom settings per user per test)
CREATE TABLE IF NOT EXISTS test_user_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extra_time_minutes INTEGER,
  submit_disabled BOOLEAN,
  result_release_delay_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT test_user_overrides_unique UNIQUE (test_id, user_id)
);

-- ==========================================
-- DPP (Daily Practice Problems)
-- ==========================================

CREATE TABLE IF NOT EXISTS dpps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dpp_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dpp_id UUID NOT NULL REFERENCES dpps(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dpp_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dpp_id UUID NOT NULL REFERENCES dpps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  score NUMERIC(10, 2),
  total_marks INTEGER,
  time_taken_seconds INTEGER,
  answers JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- MONITORING & PROCTORING
-- ==========================================

-- Proctoring test settings
CREATE TABLE IF NOT EXISTS proctoring_test_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  require_camera BOOLEAN DEFAULT TRUE,
  require_microphone BOOLEAN DEFAULT TRUE,
  require_screen BOOLEAN DEFAULT TRUE,
  allow_optional_device_fallback BOOLEAN DEFAULT FALSE,
  recording_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proctoring user overrides
CREATE TABLE IF NOT EXISTS proctoring_user_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed BOOLEAN DEFAULT TRUE,
  enabled BOOLEAN DEFAULT TRUE,
  require_camera BOOLEAN,
  require_microphone BOOLEAN,
  require_screen BOOLEAN,
  allow_optional_device_fallback BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT proctoring_user_overrides_unique UNIQUE (test_id, user_id)
);

-- Monitoring sessions (live proctoring sessions)
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE UNIQUE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  provider TEXT DEFAULT 'livekit',
  provider_room_name TEXT,
  camera_enabled BOOLEAN,
  microphone_enabled BOOLEAN,
  screen_enabled BOOLEAN,
  recording_enabled BOOLEAN DEFAULT FALSE,
  consent_accepted_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring events (events during proctoring session)
CREATE TABLE IF NOT EXISTS monitoring_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type monitoring_event_type_enum,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring permissions
CREATE TABLE IF NOT EXISTS monitoring_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES monitoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_granted BOOLEAN DEFAULT FALSE,
  microphone_granted BOOLEAN DEFAULT FALSE,
  screen_granted BOOLEAN DEFAULT FALSE,
  permissions_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proctoring sessions (alternative naming - may be used instead of monitoring_sessions)
CREATE TABLE IF NOT EXISTS proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE UNIQUE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  provider TEXT DEFAULT 'livekit',
  provider_room_name TEXT,
  camera_enabled BOOLEAN,
  microphone_enabled BOOLEAN,
  screen_enabled BOOLEAN,
  recording_enabled BOOLEAN DEFAULT FALSE,
  consent_accepted_at TIMESTAMP WITH TIME ZONE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proctoring events
CREATE TABLE IF NOT EXISTS proctoring_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PAYMENTS & COUPONS
-- ==========================================

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_type payment_type_enum,
  status payment_status_enum DEFAULT 'pending',
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  discount_percent NUMERIC(5, 2),
  discount_amount NUMERIC(10, 2),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- NOTIFICATIONS & COMMUNICATIONS
-- ==========================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type_enum,
  title TEXT,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community messages
CREATE TABLE IF NOT EXISTS community_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PLATFORM SETTINGS & AUDIT LOGS
-- ==========================================

-- Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

-- User & Auth
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_members_institution ON institution_members(institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_members_user ON institution_members(user_id);

-- Courses & Chapters
CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter_id);

-- Batches
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_batch ON batch_enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_user ON batch_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_tests_batch ON batch_tests(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_tests_test ON batch_tests(test_id);

-- Tests
CREATE INDEX IF NOT EXISTS idx_test_subjects_test ON test_subjects(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sections_test ON test_sections(test_id);
CREATE INDEX IF NOT EXISTS idx_test_section_questions_test ON test_section_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_section_questions_section ON test_section_questions(test_section_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_test ON test_questions(test_id);

-- Test Attempts
CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_completed ON test_attempts(completed_at);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_user ON test_attempts(test_id, user_id);

-- Monitoring
CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_attempt ON monitoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_sessions_user ON monitoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_session ON monitoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_attempt ON monitoring_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON proctoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_user ON proctoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session ON proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_attempt ON proctoring_events(attempt_id);

-- DPP
CREATE INDEX IF NOT EXISTS idx_dpp_questions_dpp ON dpp_questions(dpp_id);
CREATE INDEX IF NOT EXISTS idx_dpp_attempts_dpp ON dpp_attempts(dpp_id);
CREATE INDEX IF NOT EXISTS idx_dpp_attempts_user ON dpp_attempts(user_id);

-- Other
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dpp_attempts ENABLE ROW LEVEL SECURITY;

-- Profile: Users can read their own, Admins can read all
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Test Attempts: Users can see their own, Admins can see all
CREATE POLICY "Users can read own test attempts" ON test_attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read all test attempts" ON test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Batch Enrollments: Users can see their own enrollments
CREATE POLICY "Users can read own enrollments" ON batch_enrollments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can read enrollments" ON batch_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Notifications: Users can only see their own
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- ==========================================
-- TRIGGERS
-- ==========================================

-- Update profiles.updated_at automatically
CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update tests.updated_at automatically
CREATE OR REPLACE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON tests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update test_attempts.updated_at automatically
CREATE OR REPLACE TRIGGER update_test_attempts_updated_at
  BEFORE UPDATE ON test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
