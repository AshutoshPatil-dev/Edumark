-- ============================================================
-- Feature 12: Multi-Institution / Department Support
-- Run this in your Supabase SQL Editor
-- Safe to re-run (all statements are idempotent)
-- ============================================================

-- 1. Create the institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier (e.g. 'spit-mumbai')
  logo_url TEXT,
  address TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb -- extensible config (subjects, divisions, etc.)
);

-- 2. Add institution_id to profiles (nullable for backward compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 3. Add institution_id to students
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE students ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 4. Add institution_id to timetable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'timetable' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE timetable ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 5. Add institution_id to attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 6. Add institution_id to admin_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_logs' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE admin_logs ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 7. Add institution_id to leave_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leave_requests' AND column_name = 'institution_id'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN institution_id UUID REFERENCES institutions(id);
  END IF;
END $$;

-- 8. Indexes for institution-scoped queries
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_timetable_institution ON timetable(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_institution ON attendance(institution_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_institution ON admin_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_institution ON leave_requests(institution_id);

-- 9. Enable RLS on institutions
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own institution
DROP POLICY IF EXISTS "Users can view own institution" ON institutions;
CREATE POLICY "Users can view own institution"
  ON institutions FOR SELECT
  USING (
    id IN (SELECT institution_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- RLS: Only super-admins can create institutions (role = 'admin' with no institution = super-admin)
DROP POLICY IF EXISTS "Admins can create institutions" ON institutions;
CREATE POLICY "Admins can create institutions"
  ON institutions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS: Institution admins can update their institution
DROP POLICY IF EXISTS "Admins can update own institution" ON institutions;
CREATE POLICY "Admins can update own institution"
  ON institutions FOR UPDATE
  USING (
    id IN (SELECT institution_id FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- ============================================================
-- MIGRATION HELPER: Assign existing data to a default institution
-- Run this once to migrate your existing single-tenant data
-- ============================================================
INSERT INTO institutions (name, slug) VALUES ('My College', 'my-college')
  ON CONFLICT (slug) DO NOTHING;

UPDATE profiles SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
UPDATE students SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
UPDATE timetable SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
UPDATE attendance SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
UPDATE admin_logs SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
UPDATE leave_requests SET institution_id = (SELECT id FROM institutions WHERE slug = 'my-college')
  WHERE institution_id IS NULL;
