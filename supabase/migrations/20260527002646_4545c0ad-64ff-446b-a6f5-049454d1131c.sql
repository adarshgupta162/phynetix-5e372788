
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.touch_proctoring_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enable RLS on monitoring_events with scoped policies
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all monitoring events"
ON public.monitoring_events FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Students view their own monitoring events"
ON public.monitoring_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.monitoring_sessions ms
  WHERE ms.id = monitoring_events.session_id AND ms.student_id = auth.uid()
));

CREATE POLICY "Students insert own monitoring events"
ON public.monitoring_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.monitoring_sessions ms
  WHERE ms.id = monitoring_events.session_id AND ms.student_id = auth.uid()
));

CREATE POLICY "Staff can manage monitoring events"
ON public.monitoring_events FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

GRANT SELECT, INSERT ON public.monitoring_events TO authenticated;
GRANT ALL ON public.monitoring_events TO service_role;

-- Replace overly permissive monitoring_sessions policy
DROP POLICY IF EXISTS allow_all_monitoring_sessions ON public.monitoring_sessions;

CREATE POLICY "Students view own monitoring sessions"
ON public.monitoring_sessions FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Students insert own monitoring sessions"
ON public.monitoring_sessions FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own monitoring sessions"
ON public.monitoring_sessions FOR UPDATE TO authenticated
USING (student_id = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (student_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete monitoring sessions"
ON public.monitoring_sessions FOR DELETE TO authenticated
USING (public.is_staff(auth.uid()));

-- Tighten batch_enrollments staff policy: limit destructive ops to admins, and scope to institution when set
DROP POLICY IF EXISTS "Staff can manage enrollments" ON public.batch_enrollments;

CREATE POLICY "Admins manage enrollments in their institution"
ON public.batch_enrollments FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_enrollments.batch_id
        AND (
          b.institution_id IS NULL
          OR b.institution_id = public.get_user_institution_id(auth.uid())
        )
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_enrollments.batch_id
        AND (
          b.institution_id IS NULL
          OR b.institution_id = public.get_user_institution_id(auth.uid())
        )
    )
  )
);

-- Hide correct answers in qb_questions and dpp_questions via column privileges
REVOKE SELECT ON public.qb_questions FROM anon, authenticated;
GRANT SELECT (id, course_id, chapter_id, qno, type, options, difficulty, marks, text_source, pdf_page, pdf_coords, created_at, question_text, options_text)
  ON public.qb_questions TO anon, authenticated;

REVOKE SELECT ON public.dpp_questions FROM anon, authenticated;
GRANT SELECT (id, dpp_id, question_number, question_text, question_image_url, question_type, options, marks, negative_marks, difficulty, order_index, created_at, updated_at, question_image_urls, solution_image_urls, solution_text, solution_image_url)
  ON public.dpp_questions TO anon, authenticated;
-- Note: correct/correct_answer columns now only readable via service_role / staff RPCs.
GRANT ALL ON public.qb_questions TO service_role;
GRANT ALL ON public.dpp_questions TO service_role;
