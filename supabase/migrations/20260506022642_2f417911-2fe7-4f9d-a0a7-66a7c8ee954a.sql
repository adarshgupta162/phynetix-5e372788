
-- 1. Public bucket for question/solution images
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read question-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

CREATE POLICY "Staff upload question-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update question-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'question-images' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete question-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images' AND public.is_staff(auth.uid()));

-- 2. Institutions
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.institution_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff', -- 'admin' | 'teacher' | 'staff'
  invited_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(institution_id, user_id)
);

ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_inst_members_user ON public.institution_members(user_id);
CREATE INDEX idx_inst_members_inst ON public.institution_members(institution_id);

-- 3. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_institution_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT institution_id FROM public.institution_members WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_institution_admin(_user_id uuid, _institution_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_members
    WHERE user_id = _user_id AND institution_id = _institution_id AND role = 'admin'
  )
$$;

-- Super-admin = has 'admin' role in user_roles AND no institution membership
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
    AND NOT EXISTS (SELECT 1 FROM public.institution_members WHERE user_id = _user_id)
$$;

-- 4. Institutions RLS
CREATE POLICY "Super admin manages institutions"
ON public.institutions FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members view their institution"
ON public.institutions FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR id = public.get_user_institution_id(auth.uid())
);

-- 5. institution_members RLS
CREATE POLICY "Super admin manages all members"
ON public.institution_members FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Inst admins manage own members"
ON public.institution_members FOR ALL
USING (public.is_institution_admin(auth.uid(), institution_id))
WITH CHECK (public.is_institution_admin(auth.uid(), institution_id));

CREATE POLICY "Members view own institution members"
ON public.institution_members FOR SELECT
USING (institution_id = public.get_user_institution_id(auth.uid()));

-- 6. Add tenant + join code to batches
ALTER TABLE public.batches
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN join_code text UNIQUE DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

CREATE INDEX idx_batches_institution ON public.batches(institution_id);
CREATE INDEX idx_batches_join_code ON public.batches(join_code);

-- Replace batches RLS
DROP POLICY IF EXISTS "Anyone can view active batches" ON public.batches;
DROP POLICY IF EXISTS "Staff can manage batches" ON public.batches;

CREATE POLICY "Super admin manages all batches"
ON public.batches FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Inst staff manage own batches"
ON public.batches FOR ALL
USING (
  institution_id IS NOT NULL
  AND institution_id = public.get_user_institution_id(auth.uid())
  AND public.is_staff(auth.uid())
)
WITH CHECK (
  institution_id IS NOT NULL
  AND institution_id = public.get_user_institution_id(auth.uid())
  AND public.is_staff(auth.uid())
);

-- Public catalog: only platform (institution_id IS NULL) batches; institution members see their own too;
-- Enrolled users always see their batch.
CREATE POLICY "View batches by tenant or enrollment"
ON public.batches FOR SELECT
USING (
  is_active = true AND (
    institution_id IS NULL
    OR institution_id = public.get_user_institution_id(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.batch_enrollments
      WHERE batch_id = batches.id AND user_id = auth.uid() AND is_active = true
    )
  )
);

-- 7. Library: tenant + visibility
ALTER TABLE public.phynetix_library
  ADD COLUMN institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN visibility text NOT NULL DEFAULT 'global'; -- 'global' | 'private'

CREATE INDEX idx_library_institution ON public.phynetix_library(institution_id);

DROP POLICY IF EXISTS "Staff can view library questions" ON public.phynetix_library;
DROP POLICY IF EXISTS "Staff can create library questions" ON public.phynetix_library;
DROP POLICY IF EXISTS "Staff can update library questions" ON public.phynetix_library;
DROP POLICY IF EXISTS "Staff can delete library questions" ON public.phynetix_library;

-- Super admin: full
CREATE POLICY "Super admin full library access"
ON public.phynetix_library FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Institution staff: see global + own private; manage own private
CREATE POLICY "Inst staff view shared/own library"
ON public.phynetix_library FOR SELECT
USING (
  public.is_staff(auth.uid()) AND (
    visibility = 'global'
    OR institution_id = public.get_user_institution_id(auth.uid())
  )
);

CREATE POLICY "Inst staff insert own library"
ON public.phynetix_library FOR INSERT
WITH CHECK (
  public.is_staff(auth.uid())
  AND institution_id = public.get_user_institution_id(auth.uid())
  AND visibility = 'private'
);

CREATE POLICY "Inst staff update own library"
ON public.phynetix_library FOR UPDATE
USING (
  public.is_staff(auth.uid())
  AND institution_id = public.get_user_institution_id(auth.uid())
);

CREATE POLICY "Inst staff delete own library"
ON public.phynetix_library FOR DELETE
USING (
  public.is_staff(auth.uid())
  AND institution_id = public.get_user_institution_id(auth.uid())
);

-- 8. Join-by-code RPC (students)
CREATE OR REPLACE FUNCTION public.join_batch_with_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_batch_id
  FROM public.batches
  WHERE upper(join_code) = upper(_code) AND is_active = true
  LIMIT 1;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive code');
  END IF;

  INSERT INTO public.batch_enrollments (user_id, batch_id, enrollment_type, payment_status, is_active)
  VALUES (v_user, v_batch_id, 'code', 'free', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$;

-- 9. Updated_at triggers
CREATE TRIGGER trg_institutions_updated
BEFORE UPDATE ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
