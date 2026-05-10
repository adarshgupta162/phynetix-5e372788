BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'proctoring_alert_severity'
  ) THEN
    CREATE TYPE public.proctoring_alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END
$$;

ALTER TYPE public.proctoring_alert_severity ADD VALUE IF NOT EXISTS 'low';
ALTER TYPE public.proctoring_alert_severity ADD VALUE IF NOT EXISTS 'medium';
ALTER TYPE public.proctoring_alert_severity ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.proctoring_alert_severity ADD VALUE IF NOT EXISTS 'critical';

CREATE TABLE IF NOT EXISTS public.monitoring_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camera_granted boolean NOT NULL DEFAULT false,
  microphone_granted boolean NOT NULL DEFAULT false,
  screen_granted boolean NOT NULL DEFAULT false,
  camera_state text,
  microphone_state text,
  screen_state text,
  permissions_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id),
  UNIQUE (attempt_id)
);

CREATE TABLE IF NOT EXISTS public.proctoring_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.proctoring_events(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity public.proctoring_alert_severity NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proctoring_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'livekit',
  storage_bucket text,
  storage_path text,
  playback_url text,
  duration_seconds integer,
  size_bytes bigint,
  checksum text,
  recorded_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_monitoring_permissions_test_user ON public.monitoring_permissions(test_id, user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_alerts_session_created ON public.proctoring_alerts(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_alerts_status_created ON public.proctoring_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_recordings_session_created ON public.proctoring_recordings(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctoring_recordings_expires_at ON public.proctoring_recordings(expires_at);

ALTER TABLE public.monitoring_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_recordings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_permissions' AND policyname = 'Admins manage monitoring permissions'
  ) THEN
    CREATE POLICY "Admins manage monitoring permissions" ON public.monitoring_permissions
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitoring_permissions' AND policyname = 'Students manage own monitoring permissions'
  ) THEN
    CREATE POLICY "Students manage own monitoring permissions" ON public.monitoring_permissions
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctoring_alerts' AND policyname = 'Admins manage proctoring alerts'
  ) THEN
    CREATE POLICY "Admins manage proctoring alerts" ON public.proctoring_alerts
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctoring_alerts' AND policyname = 'Students view own proctoring alerts'
  ) THEN
    CREATE POLICY "Students view own proctoring alerts" ON public.proctoring_alerts
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctoring_recordings' AND policyname = 'Admins manage proctoring recordings'
  ) THEN
    CREATE POLICY "Admins manage proctoring recordings" ON public.proctoring_recordings
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proctoring_recordings' AND policyname = 'Students view own proctoring recordings'
  ) THEN
    CREATE POLICY "Students view own proctoring recordings" ON public.proctoring_recordings
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.log_proctoring_schema_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
BEGIN
  IF to_regclass('public.audit_logs') IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  actor_id := COALESCE(auth.uid(), (to_jsonb(COALESCE(NEW, OLD))->>'updated_by')::uuid, (to_jsonb(COALESCE(NEW, OLD))->>'created_by')::uuid, (to_jsonb(COALESCE(NEW, OLD))->>'user_id')::uuid);
  IF actor_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    actor_id,
    lower(TG_TABLE_NAME || '_' || TG_OP),
    TG_TABLE_NAME,
    to_jsonb(COALESCE(NEW, OLD))->>'id',
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.touch_proctoring_updated_at()') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_monitoring_permissions_updated_at' AND tgrelid = 'public.monitoring_permissions'::regclass) THEN
      CREATE TRIGGER touch_monitoring_permissions_updated_at BEFORE UPDATE ON public.monitoring_permissions FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_proctoring_alerts_updated_at' AND tgrelid = 'public.proctoring_alerts'::regclass) THEN
      CREATE TRIGGER touch_proctoring_alerts_updated_at BEFORE UPDATE ON public.proctoring_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'touch_proctoring_recordings_updated_at' AND tgrelid = 'public.proctoring_recordings'::regclass) THEN
      CREATE TRIGGER touch_proctoring_recordings_updated_at BEFORE UPDATE ON public.proctoring_recordings FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
    END IF;
  END IF;

  IF to_regclass('public.proctoring_test_settings') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_proctoring_test_settings_changes' AND tgrelid = 'public.proctoring_test_settings'::regclass) THEN
    CREATE TRIGGER audit_proctoring_test_settings_changes AFTER INSERT OR UPDATE OR DELETE ON public.proctoring_test_settings FOR EACH ROW EXECUTE FUNCTION public.log_proctoring_schema_audit();
  END IF;
  IF to_regclass('public.proctoring_user_overrides') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_proctoring_user_overrides_changes' AND tgrelid = 'public.proctoring_user_overrides'::regclass) THEN
    CREATE TRIGGER audit_proctoring_user_overrides_changes AFTER INSERT OR UPDATE OR DELETE ON public.proctoring_user_overrides FOR EACH ROW EXECUTE FUNCTION public.log_proctoring_schema_audit();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_monitoring_permissions_changes' AND tgrelid = 'public.monitoring_permissions'::regclass) THEN
    CREATE TRIGGER audit_monitoring_permissions_changes AFTER INSERT OR UPDATE OR DELETE ON public.monitoring_permissions FOR EACH ROW EXECUTE FUNCTION public.log_proctoring_schema_audit();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prune_proctoring_data(target_test_id uuid DEFAULT NULL)
RETURNS TABLE(deleted_sessions bigint, deleted_events bigint, deleted_alerts bigint, deleted_recordings bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed_sessions bigint := 0;
  removed_events bigint := 0;
  removed_alerts bigint := 0;
  removed_recordings bigint := 0;
BEGIN
  WITH retention AS (
    SELECT t.id AS test_id, COALESCE(s.retention_days, 30) AS retention_days
    FROM public.tests t
    LEFT JOIN public.proctoring_test_settings s ON s.test_id = t.id
    WHERE target_test_id IS NULL OR t.id = target_test_id
  ), deleted_events_cte AS (
    DELETE FROM public.proctoring_events e USING retention r
    WHERE e.test_id = r.test_id AND e.created_at < now() - make_interval(days => r.retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO removed_events FROM deleted_events_cte;

  WITH retention AS (
    SELECT t.id AS test_id, COALESCE(s.retention_days, 30) AS retention_days
    FROM public.tests t
    LEFT JOIN public.proctoring_test_settings s ON s.test_id = t.id
    WHERE target_test_id IS NULL OR t.id = target_test_id
  ), deleted_alerts_cte AS (
    DELETE FROM public.proctoring_alerts a USING retention r
    WHERE a.test_id = r.test_id AND a.created_at < now() - make_interval(days => r.retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO removed_alerts FROM deleted_alerts_cte;

  WITH retention AS (
    SELECT t.id AS test_id, COALESCE(s.retention_days, 30) AS retention_days
    FROM public.tests t
    LEFT JOIN public.proctoring_test_settings s ON s.test_id = t.id
    WHERE target_test_id IS NULL OR t.id = target_test_id
  ), deleted_recordings_cte AS (
    DELETE FROM public.proctoring_recordings rcd USING retention r
    WHERE rcd.test_id = r.test_id AND COALESCE(rcd.expires_at, rcd.created_at) < now() - make_interval(days => r.retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO removed_recordings FROM deleted_recordings_cte;

  WITH retention AS (
    SELECT t.id AS test_id, COALESCE(s.retention_days, 30) AS retention_days
    FROM public.tests t
    LEFT JOIN public.proctoring_test_settings s ON s.test_id = t.id
    WHERE target_test_id IS NULL OR t.id = target_test_id
  ), deleted_sessions_cte AS (
    DELETE FROM public.proctoring_sessions ps USING retention r
    WHERE ps.test_id = r.test_id
      AND ps.status IN ('ended', 'failed', 'stale')
      AND COALESCE(ps.ended_at, ps.updated_at, ps.created_at) < now() - make_interval(days => r.retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO removed_sessions FROM deleted_sessions_cte;

  RETURN QUERY SELECT removed_sessions, removed_events, removed_alerts, removed_recordings;
END;
$$;

CREATE OR REPLACE FUNCTION public.proctoring_schema_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  required_tables text[] := ARRAY['proctoring_test_settings', 'proctoring_user_overrides', 'proctoring_sessions', 'proctoring_events', 'proctoring_alerts', 'proctoring_recordings', 'monitoring_permissions'];
  required_realtime_tables text[] := ARRAY['proctoring_sessions', 'proctoring_events', 'proctoring_alerts', 'proctoring_recordings'];
  required_functions text[] := ARRAY['touch_proctoring_updated_at', 'log_proctoring_schema_audit', 'prune_proctoring_data', 'proctoring_schema_health'];
  required_columns jsonb := jsonb_build_object(
    'proctoring_test_settings', jsonb_build_array('id', 'test_id', 'enabled', 'allow_specific_users_only'),
    'proctoring_user_overrides', jsonb_build_array('id', 'test_id', 'user_id', 'allowed'),
    'proctoring_sessions', jsonb_build_array('id', 'attempt_id', 'test_id', 'user_id', 'status', 'provider_room_name', 'last_heartbeat_at'),
    'proctoring_events', jsonb_build_array('id', 'session_id', 'attempt_id', 'event_type', 'created_at'),
    'proctoring_alerts', jsonb_build_array('id', 'session_id', 'attempt_id', 'alert_type', 'severity', 'status', 'created_at'),
    'proctoring_recordings', jsonb_build_array('id', 'session_id', 'attempt_id', 'provider', 'created_at'),
    'monitoring_permissions', jsonb_build_array('id', 'session_id', 'attempt_id', 'camera_granted', 'screen_granted', 'created_at')
  );
  missing_tables text[] := ARRAY[]::text[];
  missing_realtime_tables text[] := ARRAY[]::text[];
  missing_functions text[] := ARRAY[]::text[];
  missing_columns jsonb := '{}'::jsonb;
  v_table text;
  v_column text;
BEGIN
  FOREACH v_table IN ARRAY required_tables LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN
      missing_tables := array_append(missing_tables, v_table);
      CONTINUE;
    END IF;

    FOR v_column IN SELECT jsonb_array_elements_text(required_columns -> v_table) LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_column
      ) THEN
        missing_columns := jsonb_set(
          missing_columns,
          ARRAY[v_table],
          COALESCE(missing_columns -> v_table, '[]'::jsonb) || to_jsonb(v_column),
          true
        );
      END IF;
    END LOOP;
  END LOOP;

  FOREACH v_table IN ARRAY required_realtime_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_publication p WHERE p.pubname = 'supabase_realtime')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = v_table
      ) THEN
      missing_realtime_tables := array_append(missing_realtime_tables, v_table);
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY required_functions LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc proc
      JOIN pg_namespace ns ON ns.oid = proc.pronamespace
      WHERE ns.nspname = 'public' AND proc.proname = v_table
    ) THEN
      missing_functions := array_append(missing_functions, v_table);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'missing_tables', to_jsonb(missing_tables),
    'missing_columns', missing_columns,
    'missing_realtime_tables', to_jsonb(missing_realtime_tables),
    'missing_functions', to_jsonb(missing_functions),
    'stale_migrations', CASE
      WHEN cardinality(missing_tables) > 0 OR jsonb_object_length(missing_columns) > 0 OR cardinality(missing_realtime_tables) > 0 OR cardinality(missing_functions) > 0
      THEN to_jsonb(ARRAY[
        '20260510090000_add_live_proctoring.sql',
        '20260510100500_fix_proctoring_settings_table_compat.sql',
        '20260510113000_fix_proctoring_user_overrides_compat.sql',
        '20260510140000_repair_live_monitoring_schema.sql',
        '20260510153000_complete_monitoring_schema_recovery.sql'
      ])
      ELSE '[]'::jsonb
    END
  );
END;
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
      WHERE pr.prpubid = realtime_pub_oid AND n.nspname = 'public' AND c.relname = 'proctoring_alerts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_alerts;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pr.prpubid = realtime_pub_oid AND n.nspname = 'public' AND c.relname = 'proctoring_recordings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_recordings;
    END IF;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
