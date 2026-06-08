-- Consolidated Database Schema Migration
-- This migration consolidates and deduplicates the entire database schema
-- Replaces: All previous migrations with conflicting table/column definitions
BEGIN;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'student');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_session_status'
  ) THEN
    CREATE TYPE public.proctoring_session_status AS ENUM ('pending', 'active', 'ended', 'failed', 'stale');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_event_type'
  ) THEN
    CREATE TYPE public.proctoring_event_type AS ENUM (
      'consent_accepted', 'permission_state', 'session_started', 'session_stopped',
      'heartbeat', 'question_change', 'subject_change', 'answer_saved',
      'fullscreen_exit', 'focus_lost', 'focus_returned',
      'visibility_hidden', 'visibility_visible', 'screen_share_stopped',
      'camera_stopped', 'microphone_muted', 'provider_connected',
      'provider_disconnected', 'failure'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_alert_severity'
  ) THEN
    CREATE TYPE public.proctoring_alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END
$$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role public.app_role NOT NULL DEFAULT 'student',
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  target_exam TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#8b5cf6',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  image_url TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tests
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL DEFAULT 'regular',
  exam_type TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_published BOOLEAN DEFAULT false,
  show_solutions BOOLEAN DEFAULT true,
  result_release_delay_minutes INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test Questions (junction table)
CREATE TABLE IF NOT EXISTS public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  UNIQUE (test_id, question_id)
);

-- Test Attempts
CREATE TABLE IF NOT EXISTS public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_submitted_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  total_marks INTEGER,
  rank INTEGER,
  percentile DECIMAL(5,2),
  answers JSONB,
  time_per_question JSONB,
  time_taken_seconds INTEGER,
  fullscreen_exit_count INTEGER DEFAULT 0,
  extra_time_minutes INTEGER DEFAULT 0,
  submit_disabled BOOLEAN DEFAULT false,
  result_release_delay_minutes INTEGER DEFAULT 0,
  result_available_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Batch Management
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  max_students INTEGER,
  current_students INTEGER DEFAULT 0,
  instructions TEXT,
  welcome_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Batch Enrollments
CREATE TABLE IF NOT EXISTS public.batch_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (batch_id, user_id)
);

-- Batch Tests
CREATE TABLE IF NOT EXISTS public.batch_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  unlock_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (batch_id, test_id)
);

-- Test Sections (for PDF-based tests)
CREATE TABLE IF NOT EXISTS public.test_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.test_subjects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  section_type TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test Subjects
CREATE TABLE IF NOT EXISTS public.test_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test Section Questions
CREATE TABLE IF NOT EXISTS public.test_section_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.test_sections(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  marks INTEGER DEFAULT 4,
  negative_marks INTEGER DEFAULT 1,
  is_bonus BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  pdf_page INTEGER,
  image_url TEXT,
  image_urls JSONB,
  paragraph_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Question Paragraphs
CREATE TABLE IF NOT EXISTS public.question_paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  paragraph_text TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test User Overrides
CREATE TABLE IF NOT EXISTS public.test_user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extra_time_minutes INTEGER DEFAULT 0,
  submit_disabled BOOLEAN DEFAULT false,
  result_release_delay_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

-- ============================================================================
-- PROCTORING TABLES
-- ============================================================================

-- Proctoring Test Settings
CREATE TABLE IF NOT EXISTS public.proctoring_test_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  allow_specific_users_only BOOLEAN NOT NULL DEFAULT false,
  require_camera BOOLEAN NOT NULL DEFAULT true,
  require_microphone BOOLEAN NOT NULL DEFAULT true,
  require_screen BOOLEAN NOT NULL DEFAULT true,
  allow_optional_device_fallback BOOLEAN NOT NULL DEFAULT false,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  instructions TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proctoring User Overrides
CREATE TABLE IF NOT EXISTS public.proctoring_user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN,
  require_camera BOOLEAN,
  require_microphone BOOLEAN,
  require_screen BOOLEAN,
  allow_optional_device_fallback BOOLEAN,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

-- Proctoring Sessions
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE UNIQUE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.proctoring_session_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'livekit',
  provider_room_name TEXT NOT NULL,
  camera_track_id TEXT,
  microphone_track_id TEXT,
  screen_track_id TEXT,
  camera_enabled BOOLEAN NOT NULL DEFAULT false,
  microphone_enabled BOOLEAN NOT NULL DEFAULT false,
  screen_enabled BOOLEAN NOT NULL DEFAULT false,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  consent_version TEXT NOT NULL DEFAULT 'live-proctoring-v1',
  consent_accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proctoring Events
CREATE TABLE IF NOT EXISTS public.proctoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.proctoring_event_type NOT NULL,
  question_id UUID,
  subject_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monitoring Permissions
CREATE TABLE IF NOT EXISTS public.monitoring_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE UNIQUE,
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE UNIQUE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_granted BOOLEAN NOT NULL DEFAULT false,
  microphone_granted BOOLEAN NOT NULL DEFAULT false,
  screen_granted BOOLEAN NOT NULL DEFAULT false,
  camera_state TEXT,
  microphone_state TEXT,
  screen_state TEXT,
  permissions_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proctoring Alerts
CREATE TABLE IF NOT EXISTS public.proctoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.proctoring_events(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity public.proctoring_alert_severity NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proctoring Recordings
CREATE TABLE IF NOT EXISTS public.proctoring_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'livekit',
  storage_bucket TEXT,
  storage_path TEXT,
  playback_url TEXT,
  duration_seconds INTEGER,
  size_bytes BIGINT,
  checksum TEXT,
  recorded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, storage_path)
);

-- Monitoring Screenshots
CREATE TABLE IF NOT EXISTS public.monitoring_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.proctoring_events(id) ON DELETE SET NULL,
  storage_bucket TEXT,
  storage_path TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  checksum TEXT,
  captured_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, storage_path)
);

-- ============================================================================
-- AUDIT & LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- ENABLE RLS & CREATE INDEXES
-- ============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_section_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_test_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_screenshots ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test ON public.test_attempts(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_user ON public.batch_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_enrollments_batch ON public.batch_enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_tests_batch ON public.batch_tests(batch_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt ON public.proctoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_user ON public.proctoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session ON public.proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_user ON public.proctoring_events(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_permissions_session ON public.monitoring_permissions(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_alerts_session_created ON public.proctoring_alerts(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_alerts_status ON public.proctoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_proctoring_recordings_session ON public.proctoring_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_recordings_expires ON public.proctoring_recordings(expires_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_screenshots_session ON public.monitoring_screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================================
-- BATCH ENROLLMENT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_batch_students(_batch_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.batches
  SET current_students = (
    SELECT COUNT(*) FROM public.batch_enrollments
    WHERE batch_id = _batch_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  WHERE id = _batch_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_batch_enrollment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_batch_students(OLD.batch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.batch_id <> OLD.batch_id THEN
    PERFORM public.recompute_batch_students(OLD.batch_id);
    PERFORM public.recompute_batch_students(NEW.batch_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_batch_students(NEW.batch_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS batch_enrollments_count_trg ON public.batch_enrollments;
CREATE TRIGGER batch_enrollments_count_trg
AFTER INSERT OR UPDATE OR DELETE ON public.batch_enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_batch_enrollment_count();

-- Backfill batch student counts
UPDATE public.batches b
SET current_students = sub.cnt
FROM (
  SELECT batch_id, COUNT(*) AS cnt
  FROM public.batch_enrollments
  WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
  GROUP BY batch_id
) sub
WHERE b.id = sub.batch_id;

UPDATE public.batches
SET current_students = 0
WHERE id NOT IN (SELECT DISTINCT batch_id FROM public.batch_enrollments WHERE is_active = true);

-- ============================================================================
-- PROCTORING UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_proctoring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_proctoring_test_settings_updated_at ON public.proctoring_test_settings;
CREATE TRIGGER touch_proctoring_test_settings_updated_at
  BEFORE UPDATE ON public.proctoring_test_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();

DROP TRIGGER IF EXISTS touch_proctoring_user_overrides_updated_at ON public.proctoring_user_overrides;
CREATE TRIGGER touch_proctoring_user_overrides_updated_at
  BEFORE UPDATE ON public.proctoring_user_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();

COMMIT;
