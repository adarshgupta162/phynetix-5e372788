-- Ensure proctoring_user_overrides exists and is fully configured in all environments
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

ALTER TABLE public.proctoring_user_overrides
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS allowed boolean,
  ADD COLUMN IF NOT EXISTS enabled boolean,
  ADD COLUMN IF NOT EXISTS require_camera boolean,
  ADD COLUMN IF NOT EXISTS require_microphone boolean,
  ADD COLUMN IF NOT EXISTS require_screen boolean,
  ADD COLUMN IF NOT EXISTS allow_optional_device_fallback boolean,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.proctoring_user_overrides
SET
  id = COALESCE(id, gen_random_uuid()),
  allowed = COALESCE(allowed, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE
  id IS NULL
  OR allowed IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_pkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_test_id_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_user_id_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_created_by_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_updated_by_fkey'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proctoring_user_overrides_test_id_user_id_key'
      AND conrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    ALTER TABLE public.proctoring_user_overrides
      ADD CONSTRAINT proctoring_user_overrides_test_id_user_id_key UNIQUE (test_id, user_id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_proctoring_overrides_test_user
  ON public.proctoring_user_overrides(test_id, user_id);

ALTER TABLE public.proctoring_user_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_user_overrides'
      AND policyname = 'Admins manage proctoring overrides'
  ) THEN
    CREATE POLICY "Admins manage proctoring overrides" ON public.proctoring_user_overrides
      FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proctoring_user_overrides'
      AND policyname = 'Students view own proctoring overrides'
  ) THEN
    CREATE POLICY "Students view own proctoring overrides" ON public.proctoring_user_overrides
      FOR SELECT USING (auth.uid() = user_id);
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
    WHERE tgname = 'touch_proctoring_user_overrides_updated_at'
      AND tgrelid = 'public.proctoring_user_overrides'::regclass
  ) THEN
    CREATE TRIGGER touch_proctoring_user_overrides_updated_at
      BEFORE UPDATE ON public.proctoring_user_overrides
      FOR EACH ROW EXECUTE FUNCTION public.touch_proctoring_updated_at();
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
