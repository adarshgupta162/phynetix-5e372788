-- Live monitoring / proctoring data model
CREATE TYPE public.proctoring_session_status AS ENUM ('pending', 'active', 'ended', 'failed', 'stale');
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

CREATE TABLE public.proctoring_test_settings (
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

CREATE TABLE public.proctoring_user_overrides (
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

CREATE TABLE public.proctoring_sessions (
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

CREATE TABLE public.proctoring_events (
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

CREATE INDEX idx_proctoring_settings_test_id ON public.proctoring_test_settings(test_id);
CREATE INDEX idx_proctoring_overrides_test_user ON public.proctoring_user_overrides(test_id, user_id);
CREATE INDEX idx_proctoring_sessions_status ON public.proctoring_sessions(status, last_heartbeat_at DESC);
CREATE INDEX idx_proctoring_sessions_test ON public.proctoring_sessions(test_id, user_id);
CREATE INDEX idx_proctoring_events_session_created ON public.proctoring_events(session_id, created_at DESC);
CREATE INDEX idx_proctoring_events_type_created ON public.proctoring_events(event_type, created_at DESC);

ALTER TABLE public.proctoring_test_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage proctoring settings" ON public.proctoring_test_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view published proctoring settings" ON public.proctoring_test_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tests
      WHERE tests.id = proctoring_test_settings.test_id
      AND (tests.is_published = true OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Admins manage proctoring overrides" ON public.proctoring_user_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view own proctoring overrides" ON public.proctoring_user_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins manage proctoring sessions" ON public.proctoring_sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view own proctoring sessions" ON public.proctoring_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students insert own proctoring sessions" ON public.proctoring_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students update own proctoring sessions" ON public.proctoring_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view proctoring events" ON public.proctoring_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view own proctoring events" ON public.proctoring_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Students insert own proctoring events" ON public.proctoring_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_events;

CREATE OR REPLACE FUNCTION public.touch_proctoring_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_proctoring_test_settings_updated_at
  BEFORE UPDATE ON public.proctoring_test_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();

CREATE TRIGGER touch_proctoring_user_overrides_updated_at
  BEFORE UPDATE ON public.proctoring_user_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();

CREATE TRIGGER touch_proctoring_sessions_updated_at
  BEFORE UPDATE ON public.proctoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
