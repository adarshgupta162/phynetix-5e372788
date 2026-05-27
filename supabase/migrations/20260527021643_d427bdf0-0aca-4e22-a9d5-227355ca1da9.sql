
-- Phase 5: instruction customization
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Phase 1.1: auto-maintain current_students
CREATE OR REPLACE FUNCTION public.recompute_batch_students(_batch_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.batches
  SET current_students = (
    SELECT COUNT(*) FROM public.batch_enrollments
    WHERE batch_id = _batch_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
  WHERE id = _batch_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_batch_enrollment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_batch_students(OLD.batch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.batch_id <> OLD.batch_id THEN
    PERFORM public.recompute_batch_students(OLD.batch_id);
    PERFORM public.recompute_batch_students(NEW.batch_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_batch_students(NEW.batch_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS batch_enrollments_count_trg ON public.batch_enrollments;
CREATE TRIGGER batch_enrollments_count_trg
AFTER INSERT OR UPDATE OR DELETE ON public.batch_enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_batch_enrollment_count();

-- Backfill
UPDATE public.batches b
SET current_students = sub.cnt
FROM (
  SELECT batch_id, COUNT(*) AS cnt
  FROM public.batch_enrollments
  WHERE is_active = true AND (expires_at IS NULL OR expires_at > now())
  GROUP BY batch_id
) sub
WHERE b.id = sub.batch_id;

-- Reset batches with no enrollments to 0
UPDATE public.batches
SET current_students = 0
WHERE id NOT IN (SELECT DISTINCT batch_id FROM public.batch_enrollments WHERE is_active = true);
