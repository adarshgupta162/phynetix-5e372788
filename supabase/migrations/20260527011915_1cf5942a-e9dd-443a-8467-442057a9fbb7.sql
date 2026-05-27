DROP POLICY IF EXISTS "View batches by tenant or enrollment" ON public.batches;

CREATE POLICY "View batches by tenant or enrollment"
ON public.batches
FOR SELECT
USING (
  is_active = true
  AND (
    institution_id IS NULL
    OR institution_id = public.get_user_institution_id(auth.uid())
    OR public.is_enrolled_in_batch(auth.uid(), id)
  )
);