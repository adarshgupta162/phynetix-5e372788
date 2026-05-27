
-- Add missing columns to test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS extra_time_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submit_disabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_release_delay_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result_available_at TIMESTAMP WITH TIME ZONE;

-- Add missing column to tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS result_release_delay_minutes INTEGER DEFAULT 0;

-- Add missing columns to proctoring_test_settings
ALTER TABLE public.proctoring_test_settings
  ADD COLUMN IF NOT EXISTS screenshot_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS screenshot_interval_seconds INTEGER NOT NULL DEFAULT 30;

-- Create test_user_overrides table
CREATE TABLE IF NOT EXISTS public.test_user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  extra_time_minutes INTEGER NOT NULL DEFAULT 0,
  submit_disabled BOOLEAN NOT NULL DEFAULT false,
  result_release_delay_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (test_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_user_overrides TO authenticated;
GRANT ALL ON public.test_user_overrides TO service_role;

ALTER TABLE public.test_user_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage test user overrides"
  ON public.test_user_overrides
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Users view own test overrides"
  ON public.test_user_overrides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create monitoring_screenshots table
CREATE TABLE IF NOT EXISTS public.monitoring_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  attempt_id UUID,
  test_id UUID,
  user_id UUID NOT NULL,
  storage_path TEXT,
  storage_bucket TEXT,
  image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.monitoring_screenshots TO authenticated;
GRANT ALL ON public.monitoring_screenshots TO service_role;

ALTER TABLE public.monitoring_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage monitoring screenshots"
  ON public.monitoring_screenshots
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students insert own monitoring screenshots"
  ON public.monitoring_screenshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students view own monitoring screenshots"
  ON public.monitoring_screenshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
