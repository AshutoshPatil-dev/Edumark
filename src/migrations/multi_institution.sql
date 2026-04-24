-- ============================================================
-- Feature 12: Multi-Institution / Department Support
-- Run this in your Supabase SQL Editor
-- Safe to re-run (all statements are idempotent)
-- ============================================================

-- 1. Create the institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  address TEXT,
  contact_email TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'institutions' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE institutions ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- 2. Create the public institution request inbox
CREATE TABLE IF NOT EXISTS institution_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add institution_id to multi-tenant tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE students ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timetable' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE timetable ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_logs' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE admin_logs ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 4. Indexes and constraints for institution-scoped queries
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_timetable_institution ON timetable(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_institution ON attendance(institution_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_institution ON admin_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_institution ON leave_requests(institution_id);
CREATE INDEX IF NOT EXISTS idx_institutions_created_by ON institutions(created_by);
CREATE INDEX IF NOT EXISTS idx_institution_requests_status ON institution_requests(status);
CREATE INDEX IF NOT EXISTS idx_institution_requests_created_at ON institution_requests(created_at DESC);

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_roll_no_key;
DROP INDEX IF EXISTS students_roll_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_institution_roll_no
  ON students(institution_id, roll_no);

-- 5. Security helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_onboarding_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND institution_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_institution_access(target_institution UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND institution_id = target_institution
    )
    OR EXISTS (
      SELECT 1
      FROM public.students
      WHERE user_id = auth.uid()
        AND institution_id = target_institution
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_institution(target_institution UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND institution_id = target_institution
    );
$$;

CREATE OR REPLACE FUNCTION public.can_record_attendance(target_institution UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('faculty', 'admin')
        AND institution_id = target_institution
    );
$$;

-- 6. RLS policies
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
DROP POLICY IF EXISTS "Admins can create institutions" ON institutions;
DROP POLICY IF EXISTS "Admins can update own institution" ON institutions;
DROP POLICY IF EXISTS "Institutions are visible to members" ON institutions;
DROP POLICY IF EXISTS "Institutions can be created by admins" ON institutions;
DROP POLICY IF EXISTS "Institutions can be updated by admins" ON institutions;

CREATE POLICY "Institutions are visible to members"
  ON institutions FOR SELECT
  USING (
    public.is_super_admin()
    OR created_by = auth.uid()
    OR public.has_institution_access(id)
  );

CREATE POLICY "Institutions can be created by admins"
  ON institutions FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_super_admin() OR public.is_onboarding_admin())
  );

CREATE POLICY "Institutions can be updated by admins"
  ON institutions FOR UPDATE
  USING (
    public.is_super_admin()
    OR created_by = auth.uid()
    OR public.can_manage_institution(id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR created_by = auth.uid()
    OR public.can_manage_institution(id)
  );

DROP POLICY IF EXISTS "Institution requests can be submitted publicly" ON institution_requests;
DROP POLICY IF EXISTS "Institution requests are visible to super admins" ON institution_requests;
DROP POLICY IF EXISTS "Institution requests can be managed by super admins" ON institution_requests;

CREATE POLICY "Institution requests can be submitted publicly"
  ON institution_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Institution requests are visible to super admins"
  ON institution_requests FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Institution requests can be managed by super admins"
  ON institution_requests FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Profiles are visible to institution members" ON profiles;
DROP POLICY IF EXISTS "Profiles can be updated by owners or admins" ON profiles;

CREATE POLICY "Profiles are visible to institution members"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.has_institution_access(institution_id))
  );

CREATE POLICY "Profiles can be updated by owners or admins"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_manage_institution(institution_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_manage_institution(institution_id))
    OR (
      id = auth.uid()
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND institution_id IS NOT DISTINCT FROM (SELECT institution_id FROM public.profiles WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Students are visible within an institution" ON students;
DROP POLICY IF EXISTS "Students can be managed by admins" ON students;

CREATE POLICY "Students are visible within an institution"
  ON students FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
    OR user_id = auth.uid()
  );

CREATE POLICY "Students can be managed by admins"
  ON students FOR ALL
  TO authenticated
  USING (institution_id IS NOT NULL AND public.can_manage_institution(institution_id))
  WITH CHECK (institution_id IS NOT NULL AND public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Timetable is visible within an institution" ON timetable;
DROP POLICY IF EXISTS "Timetable can be managed by admins" ON timetable;

CREATE POLICY "Timetable is visible within an institution"
  ON timetable FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
    OR (
        institution_id IS NOT NULL 
        AND batch IN (SELECT batch FROM public.students WHERE user_id = auth.uid() AND institution_id = timetable.institution_id)
    )
  );

CREATE POLICY "Timetable can be managed by admins"
  ON timetable FOR ALL
  TO authenticated
  USING (institution_id IS NOT NULL AND public.can_manage_institution(institution_id))
  WITH CHECK (institution_id IS NOT NULL AND public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Attendance is visible within an institution" ON attendance;
DROP POLICY IF EXISTS "Attendance can be recorded by staff" ON attendance;
DROP POLICY IF EXISTS "Attendance can be updated by staff" ON attendance;
DROP POLICY IF EXISTS "Attendance can be removed by admins" ON attendance;

CREATE POLICY "Attendance is visible within an institution"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "Attendance can be recorded by staff"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    marked_by = auth.uid()
    AND institution_id IS NOT NULL
    AND public.can_record_attendance(institution_id)
  );

CREATE POLICY "Attendance can be updated by staff"
  ON attendance FOR UPDATE
  TO authenticated
  USING (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
  WITH CHECK (
    marked_by = auth.uid()
    AND institution_id IS NOT NULL
    AND public.can_record_attendance(institution_id)
  );

CREATE POLICY "Attendance can be removed by admins"
  ON attendance FOR DELETE
  TO authenticated
  USING (institution_id IS NOT NULL AND public.can_manage_institution(institution_id));

DROP POLICY IF EXISTS "Admin logs are visible within an institution" ON admin_logs;
DROP POLICY IF EXISTS "Admin logs can be written by staff" ON admin_logs;

CREATE POLICY "Admin logs are visible within an institution"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_manage_institution(institution_id))
  );

CREATE POLICY "Admin logs can be written by staff"
  ON admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_super_admin()
      OR (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
    )
  );

DROP POLICY IF EXISTS "Leave requests are visible within an institution" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests can be submitted by owners" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests can be reviewed by staff" ON leave_requests;

CREATE POLICY "Leave requests are visible within an institution"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (institution_id IS NOT NULL AND public.can_record_attendance(institution_id))
    OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  );

CREATE POLICY "Leave requests can be submitted by owners"
  ON leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    institution_id IS NOT NULL
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = leave_requests.student_id
          AND user_id = auth.uid()
          AND institution_id = leave_requests.institution_id
      )
    )
  );

CREATE POLICY "Leave requests can be reviewed by staff"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (
    institution_id IS NOT NULL
    AND (
      public.can_manage_institution(institution_id)
      OR EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = leave_requests.student_id
          AND user_id = auth.uid()
          AND institution_id = leave_requests.institution_id
      )
    )
  )
  WITH CHECK (
    institution_id IS NOT NULL
    AND (
      public.can_manage_institution(institution_id)
      OR EXISTS (
        SELECT 1
        FROM public.students
        WHERE id = leave_requests.student_id
          AND user_id = auth.uid()
          AND institution_id = leave_requests.institution_id
      )
    )
  );

-- ============================================================
-- MIGRATION HELPER: Assign existing single-tenant data to a default institution
-- ============================================================
INSERT INTO institutions (name, slug)
VALUES ('My College', 'my-college')
ON CONFLICT (slug) DO NOTHING;

UPDATE profiles
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL
  AND role <> 'super_admin';

UPDATE students
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL;

UPDATE timetable
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL;

UPDATE attendance
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL;

UPDATE admin_logs
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL;

UPDATE leave_requests
SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
WHERE institution_id IS NULL;
