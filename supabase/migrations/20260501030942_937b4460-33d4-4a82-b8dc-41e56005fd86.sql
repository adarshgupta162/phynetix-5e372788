DROP POLICY IF EXISTS "Users can create own enrollments" ON public.batch_enrollments;

CREATE POLICY "Users can create own enrollments"
ON public.batch_enrollments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);