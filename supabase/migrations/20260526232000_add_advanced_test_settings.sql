BEGIN;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS result_release_delay_minutes integer NOT NULL DEFAULT 0 CHECK (result_release_delay_minutes >= 0);

ALTER TABLE public.proctoring_test_settings
  ADD COLUMN IF NOT EXISTS screenshot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS screenshot_interval_seconds integer NOT NULL DEFAULT 120 CHECK (screenshot_interval_seconds BETWEEN 10 AND 3600);

ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS extra_time_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submit_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_available_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS result_release_delay_minutes integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.test_user_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extra_time_minutes integer NOT NULL DEFAULT 0,
  submit_disabled boolean NOT NULL DEFAULT false,
  result_release_delay_minutes integer,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.monitoring_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.monitoring_sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_user_overrides_test_user ON public.test_user_overrides(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_screenshots_session_created ON public.monitoring_screenshots(session_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_screenshots_test_user ON public.monitoring_screenshots(test_id, user_id);

ALTER TABLE public.test_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_screenshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_attempts' AND policyname = 'Admins manage test attempts'
  ) THEN
    CREATE POLICY "Admins manage test attempts" ON public.test_attempts
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_user_overrides' AND policyname = 'Admins manage test user overrides'
  ) THEN
    CREATE POLICY "Admins manage test user overrides" ON public.test_user_overrides
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'test_user_overrides' AND policyname = 'Students view own test overrides'
  ) THEN
    CREATE POLICY "Students view own test overrides" ON public.test_user_overrides
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_screenshots' AND policyname = 'Admins manage monitoring screenshots'
  ) THEN
    CREATE POLICY "Admins manage monitoring screenshots" ON public.monitoring_screenshots
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_screenshots' AND policyname = 'Students insert own monitoring screenshots'
  ) THEN
    CREATE POLICY "Students insert own monitoring screenshots" ON public.monitoring_screenshots
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_screenshots' AND policyname = 'Students view own monitoring screenshots'
  ) THEN
    CREATE POLICY "Students view own monitoring screenshots" ON public.monitoring_screenshots
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('monitoring-screenshots', 'monitoring-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins manage monitoring screenshots objects'
  ) THEN
    CREATE POLICY "Admins manage monitoring screenshots objects" ON storage.objects
      FOR ALL USING (bucket_id = 'monitoring-screenshots' AND public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'monitoring-screenshots' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Students upload monitoring screenshots'
  ) THEN
    CREATE POLICY "Students upload monitoring screenshots" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'monitoring-screenshots' AND auth.uid() = owner);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Students view own monitoring screenshots'
  ) THEN
    CREATE POLICY "Students view own monitoring screenshots" ON storage.objects
      FOR SELECT USING (bucket_id = 'monitoring-screenshots' AND auth.uid() = owner);
  END IF;
END
$$;

COMMIT;
