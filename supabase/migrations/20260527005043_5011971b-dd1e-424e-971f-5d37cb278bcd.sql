
-- Add missing columns to monitoring_sessions
ALTER TABLE public.monitoring_sessions
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS student_name text,
  ADD COLUMN IF NOT EXISTS test_name text,
  ADD COLUMN IF NOT EXISTS cf_session_id text,
  ADD COLUMN IF NOT EXISTS cf_camera_track text,
  ADD COLUMN IF NOT EXISTS cf_screen_track text,
  ADD COLUMN IF NOT EXISTS cf_microphone_track text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS monitoring_sessions_status_started_idx
  ON public.monitoring_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS monitoring_sessions_test_idx
  ON public.monitoring_sessions (test_id);
CREATE INDEX IF NOT EXISTS monitoring_sessions_student_idx
  ON public.monitoring_sessions (student_id);

DROP TRIGGER IF EXISTS trg_monitoring_sessions_touch ON public.monitoring_sessions;
CREATE TRIGGER trg_monitoring_sessions_touch
  BEFORE UPDATE ON public.monitoring_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();

CREATE INDEX IF NOT EXISTS monitoring_events_session_created_idx
  ON public.monitoring_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS monitoring_screenshots_session_captured_idx
  ON public.monitoring_screenshots (session_id, captured_at DESC);

-- Realtime publication for live admin updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'monitoring_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_sessions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'monitoring_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoring_events';
  END IF;
END $$;

ALTER TABLE public.monitoring_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.monitoring_events REPLICA IDENTITY FULL;

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('monitoring-screenshots', 'monitoring-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Students upload own monitoring screenshots" ON storage.objects;
CREATE POLICY "Students upload own monitoring screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'monitoring-screenshots'
    AND (storage.foldername(name))[1] = 'screenshots'
  );

DROP POLICY IF EXISTS "Students read own monitoring screenshots" ON storage.objects;
CREATE POLICY "Students read own monitoring screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'monitoring-screenshots'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_staff(auth.uid())
      OR owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage monitoring screenshot files" ON storage.objects;
CREATE POLICY "Admins manage monitoring screenshot files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'monitoring-screenshots' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'monitoring-screenshots' AND has_role(auth.uid(), 'admin'::app_role));
