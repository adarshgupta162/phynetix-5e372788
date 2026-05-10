BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Backward compatibility: old typo used in earlier environments
DO $$
BEGIN
  IF to_regclass('public.proctoring_test_settings') IS NULL
     AND to_regclass('public.protecting_test_settings') IS NOT NULL THEN
    ALTER TABLE public.protecting_test_settings RENAME TO proctoring_test_settings;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_session_status'
  ) THEN
    CREATE TYPE public.proctoring_session_status AS ENUM ('pending', 'active', 'ended', 'failed', 'stale');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_event_type'
  ) THEN
    CREATE TYPE public.proctoring_event_type AS ENUM (
      'consent_accepted',
      'permission_state',
      'session_started',
      'session_stopped',
      'heartbeat',
      'question_change',
      'subject_change',
      'answer_saved',
      'fullscreen_exit',
      'focus_lost',
      'focus_returned',
      'visibility_hidden',
      'visibility_visible',
      'screen_share_stopped',
      'camera_stopped',
      'microphone_muted',
      'provider_connected',
      'provider_disconnected',
      'failure'
    );
  END IF;
END
$$;

ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'consent_accepted';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'permission_state';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'session_started';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'session_stopped';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'heartbeat';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'question_change';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'subject_change';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'answer_saved';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'fullscreen_exit';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'focus_lost';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'focus_returned';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'visibility_hidden';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'visibility_visible';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'screen_share_stopped';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'camera_stopped';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'microphone_muted';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'provider_connected';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'provider_disconnected';
ALTER TYPE public.proctoring_event_type ADD VALUE IF NOT EXISTS 'failure';

CREATE TABLE IF NOT EXISTS public.proctoring_test_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  allow_specific_users_only boolean NOT NULL DEFAULT false,
  require_camera boolean NOT NULL DEFAULT true,
  require_microphone boolean NOT NULL DEFAULT true,
  require_screen boolean NOT NULL DEFAULT true,
  allow_optional_device_fallback boolean NOT NULL DEFAULT false,
  recording_enabled boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  instructions text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proctoring_user_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  enabled boolean,
  require_camera boolean,
  require_microphone boolean,
  require_screen boolean,
  allow_optional_device_fallback boolean,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.proctoring_session_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'livekit',
  provider_room_name text NOT NULL,
  camera_track_id text,
  microphone_track_id text,
  screen_track_id text,
  camera_enabled boolean NOT NULL DEFAULT false,
  microphone_enabled boolean NOT NULL DEFAULT false,
  screen_enabled boolean NOT NULL DEFAULT false,
  recording_enabled boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'live-proctoring-v1',
  consent_accepted_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id)
);

CREATE TABLE IF NOT EXISTS public.proctoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.proctoring_event_type NOT NULL,
  question_id uuid,
  subject_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proctoring_test_settings
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_specific_users_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_camera boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_microphone boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_screen boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_optional_device_fallback boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.proctoring_user_overrides
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS allowed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS enabled boolean,
  ADD COLUMN IF NOT EXISTS require_camera boolean,
  ADD COLUMN IF NOT EXISTS require_microphone boolean,
  ADD COLUMN IF NOT EXISTS require_screen boolean,
  ADD COLUMN IF NOT EXISTS allow_optional_device_fallback boolean,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.proctoring_sessions
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS status public.proctoring_session_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'livekit',
  ADD COLUMN IF NOT EXISTS provider_room_name text,
  ADD COLUMN IF NOT EXISTS camera_track_id text,
  ADD COLUMN IF NOT EXISTS microphone_track_id text,
  ADD COLUMN IF NOT EXISTS screen_track_id text,
  ADD COLUMN IF NOT EXISTS camera_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS microphone_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS screen_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_version text DEFAULT 'live-proctoring-v1',
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.proctoring_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS event_type public.proctoring_event_type,
  ADD COLUMN IF NOT EXISTS question_id uuid,
  ADD COLUMN IF NOT EXISTS subject_name text,
  ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.proctoring_test_settings
SET
  id = COALESCE(id, gen_random_uuid()),
  enabled = COALESCE(enabled, false),
  allow_specific_users_only = COALESCE(allow_specific_users_only, false),
  require_camera = COALESCE(require_camera, true),
  require_microphone = COALESCE(require_microphone, true),
  require_screen = COALESCE(require_screen, true),
  allow_optional_device_fallback = COALESCE(allow_optional_device_fallback, false),
  recording_enabled = COALESCE(recording_enabled, false),
  retention_days = LEAST(3650, GREATEST(1, COALESCE(retention_days, 30))),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.proctoring_user_overrides
SET
  id = COALESCE(id, gen_random_uuid()),
  allowed = COALESCE(allowed, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.proctoring_sessions
SET
  id = COALESCE(id, gen_random_uuid()),
  status = COALESCE(status, 'pending'::public.proctoring_session_status),
  provider = COALESCE(provider, 'livekit'),
  provider_room_name = COALESCE(provider_room_name, 'proctoring-' || COALESCE(attempt_id::text, gen_random_uuid()::text)),
  camera_enabled = COALESCE(camera_enabled, false),
  microphone_enabled = COALESCE(microphone_enabled, false),
  screen_enabled = COALESCE(screen_enabled, false),
  recording_enabled = COALESCE(recording_enabled, false),
  consent_version = COALESCE(consent_version, 'live-proctoring-v1'),
  metadata = COALESCE(metadata, '{}'::jsonb),
  started_at = COALESCE(started_at, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

UPDATE public.proctoring_events
SET
  id = COALESCE(id, gen_random_uuid()),
  payload = COALESCE(payload, '{}'::jsonb),
  created_at = COALESCE(created_at, now())
WHERE id IS NULL OR payload IS NULL OR created_at IS NULL;

ALTER TABLE public.proctoring_test_settings
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN test_id SET NOT NULL,
  ALTER COLUMN enabled SET DEFAULT false,
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN allow_specific_users_only SET DEFAULT false,
  ALTER COLUMN allow_specific_users_only SET NOT NULL,
  ALTER COLUMN require_camera SET DEFAULT true,
  ALTER COLUMN require_camera SET NOT NULL,
  ALTER COLUMN require_microphone SET DEFAULT true,
  ALTER COLUMN require_microphone SET NOT NULL,
  ALTER COLUMN require_screen SET DEFAULT true,
  ALTER COLUMN require_screen SET NOT NULL,
  ALTER COLUMN allow_optional_device_fallback SET DEFAULT false,
  ALTER COLUMN allow_optional_device_fallback SET NOT NULL,
  ALTER COLUMN recording_enabled SET DEFAULT false,
  ALTER COLUMN recording_enabled SET NOT NULL,
  ALTER COLUMN retention_days SET DEFAULT 30,
  ALTER COLUMN retention_days SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.proctoring_user_overrides
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN test_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN allowed SET DEFAULT true,
  ALTER COLUMN allowed SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.proctoring_sessions
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN attempt_id SET NOT NULL,
  ALTER COLUMN test_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending'::public.proctoring_session_status,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN provider SET DEFAULT 'livekit',
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN provider_room_name SET NOT NULL,
  ALTER COLUMN camera_enabled SET DEFAULT false,
  ALTER COLUMN camera_enabled SET NOT NULL,
  ALTER COLUMN microphone_enabled SET DEFAULT false,
  ALTER COLUMN microphone_enabled SET NOT NULL,
  ALTER COLUMN screen_enabled SET DEFAULT false,
  ALTER COLUMN screen_enabled SET NOT NULL,
  ALTER COLUMN recording_enabled SET DEFAULT false,
  ALTER COLUMN recording_enabled SET NOT NULL,
  ALTER COLUMN consent_version SET DEFAULT 'live-proctoring-v1',
  ALTER COLUMN consent_version SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.proctoring_events
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN session_id SET NOT NULL,
  ALTER COLUMN attempt_id SET NOT NULL,
  ALTER COLUMN test_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN payload SET DEFAULT '{}'::jsonb,
  ALTER COLUMN payload SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_test_settings_pkey'
      AND conrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    ALTER TABLE public.proctoring_test_settings
      ADD CONSTRAINT proctoring_test_settings_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_test_settings_test_id_key'
      AND conrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    ALTER TABLE public.proctoring_test_settings
      ADD CONSTRAINT proctoring_test_settings_test_id_key UNIQUE (test_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_test_settings_test_id_fkey'
      AND conrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    ALTER TABLE public.proctoring_test_settings
      ADD CONSTRAINT proctoring_test_settings_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_test_settings_created_by_fkey'
      AND conrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    ALTER TABLE public.proctoring_test_settings
      ADD CONSTRAINT proctoring_test_settings_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_test_settings_updated_by_fkey'
      AND conrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    ALTER TABLE public.proctoring_test_settings
      ADD CONSTRAINT proctoring_test_settings_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_pkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_test_id_user_id_key'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_test_id_user_id_key UNIQUE (test_id, user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_test_id_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_user_id_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_created_by_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_updated_by_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_sessions_pkey'
      AND conrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    ALTER TABLE public.proctoring_sessions
      ADD CONSTRAINT proctoring_sessions_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_sessions_attempt_id_key'
      AND conrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    ALTER TABLE public.proctoring_sessions
      ADD CONSTRAINT proctoring_sessions_attempt_id_key UNIQUE (attempt_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_sessions_attempt_id_fkey'
      AND conrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    ALTER TABLE public.proctoring_sessions
      ADD CONSTRAINT proctoring_sessions_attempt_id_fkey
      FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_sessions_test_id_fkey'
      AND conrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    ALTER TABLE public.proctoring_sessions
      ADD CONSTRAINT proctoring_sessions_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_sessions_user_id_fkey'
      AND conrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    ALTER TABLE public.proctoring_sessions
      ADD CONSTRAINT proctoring_sessions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_events_pkey'
      AND conrelid = 'public.proctoring_events'::regclass
  ) THEN
    ALTER TABLE public.proctoring_events
      ADD CONSTRAINT proctoring_events_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_events_session_id_fkey'
      AND conrelid = 'public.proctoring_events'::regclass
  ) THEN
    ALTER TABLE public.proctoring_events
      ADD CONSTRAINT proctoring_events_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_events_attempt_id_fkey'
      AND conrelid = 'public.proctoring_events'::regclass
  ) THEN
    ALTER TABLE public.proctoring_events
      ADD CONSTRAINT proctoring_events_attempt_id_fkey
      FOREIGN KEY (attempt_id) REFERENCES public.test_attempts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_events_test_id_fkey'
      AND conrelid = 'public.proctoring_events'::regclass
  ) THEN
    ALTER TABLE public.proctoring_events
      ADD CONSTRAINT proctoring_events_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proctoring_events_user_id_fkey'
      AND conrelid = 'public.proctoring_events'::regclass
  ) THEN
    ALTER TABLE public.proctoring_events
      ADD CONSTRAINT proctoring_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_proctoring_settings_test_id ON public.proctoring_test_settings(test_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_overrides_test_user ON public.proctoring_user_overrides(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_status ON public.proctoring_sessions(status, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_test ON public.proctoring_sessions(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_session_created ON public.proctoring_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_events_type_created ON public.proctoring_events(event_type, created_at DESC);

ALTER TABLE public.proctoring_test_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_test_settings'
      AND policyname = 'Admins manage proctoring settings'
  ) THEN
    CREATE POLICY "Admins manage proctoring settings" ON public.proctoring_test_settings
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_test_settings'
      AND policyname = 'Students view published proctoring settings'
  ) THEN
    CREATE POLICY "Students view published proctoring settings" ON public.proctoring_test_settings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.tests
          WHERE tests.id = proctoring_test_settings.test_id
            AND (tests.is_published = true OR public.has_role(auth.uid(), 'admin'::app_role))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_user_overrides'
      AND policyname = 'Admins manage proctoring overrides'
  ) THEN
    CREATE POLICY "Admins manage proctoring overrides" ON public.proctoring_user_overrides
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_user_overrides'
      AND policyname = 'Students view own proctoring overrides'
  ) THEN
    CREATE POLICY "Students view own proctoring overrides" ON public.proctoring_user_overrides
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_sessions'
      AND policyname = 'Admins manage proctoring sessions'
  ) THEN
    CREATE POLICY "Admins manage proctoring sessions" ON public.proctoring_sessions
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_sessions'
      AND policyname = 'Students view own proctoring sessions'
  ) THEN
    CREATE POLICY "Students view own proctoring sessions" ON public.proctoring_sessions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_sessions'
      AND policyname = 'Students insert own proctoring sessions'
  ) THEN
    CREATE POLICY "Students insert own proctoring sessions" ON public.proctoring_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_sessions'
      AND policyname = 'Students update own proctoring sessions'
  ) THEN
    CREATE POLICY "Students update own proctoring sessions" ON public.proctoring_sessions
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_events'
      AND policyname = 'Admins view proctoring events'
  ) THEN
    CREATE POLICY "Admins view proctoring events" ON public.proctoring_events
      FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_events'
      AND policyname = 'Students view own proctoring events'
  ) THEN
    CREATE POLICY "Students view own proctoring events" ON public.proctoring_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_events'
      AND policyname = 'Students insert own proctoring events'
  ) THEN
    CREATE POLICY "Students insert own proctoring events" ON public.proctoring_events
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.touch_proctoring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'touch_proctoring_test_settings_updated_at'
      AND tgrelid = 'public.proctoring_test_settings'::regclass
  ) THEN
    CREATE TRIGGER touch_proctoring_test_settings_updated_at
      BEFORE UPDATE ON public.proctoring_test_settings
      FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'touch_proctoring_user_overrides_updated_at'
      AND tgrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    CREATE TRIGGER touch_proctoring_user_overrides_updated_at
      BEFORE UPDATE ON public.proctoring_user_overrides
      FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'touch_proctoring_sessions_updated_at'
      AND tgrelid = 'public.proctoring_sessions'::regclass
  ) THEN
    CREATE TRIGGER touch_proctoring_sessions_updated_at
      BEFORE UPDATE ON public.proctoring_sessions
      FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
  END IF;
END
$$;

DO $$
DECLARE
  realtime_pub_oid oid;
BEGIN
  SELECT oid INTO realtime_pub_oid FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF realtime_pub_oid IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = realtime_pub_oid
        AND n.nspname = 'public'
        AND c.relname = 'proctoring_sessions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_sessions;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = realtime_pub_oid
        AND n.nspname = 'public'
        AND c.relname = 'proctoring_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_events;
    END IF;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
