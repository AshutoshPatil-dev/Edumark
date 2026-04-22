import { createClient } from '@supabase/supabase-js';

export const onRequest: PagesFunction<{ 
  DB: D1Database; 
  VITE_SUPABASE_URL: string; 
  VITE_SUPABASE_ANON_KEY: string; 
}> = async (context) => {
  const { DB, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = context.env;

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Supabase credentials missing in Cloudflare environment" }), { status: 500 });
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

  try {
    const results: any = {};

    // 1. Migrate Profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      const stmt = DB.prepare("INSERT OR IGNORE INTO profiles (id, role, full_name, roll_no, assigned_subjects) VALUES (?, ?, ?, ?, ?)");
      await DB.batch(profiles.map(p => stmt.bind(p.id, p.role, p.full_name, p.roll_no, JSON.stringify(p.assigned_subjects || []))));
      results.profiles = profiles.length;
    }

    // 2. Migrate Students
    const { data: students } = await supabase.from('students').select('*');
    if (students) {
      const stmt = DB.prepare("INSERT OR IGNORE INTO students (id, name, roll_no, division, batch, user_id) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(students.map(s => stmt.bind(s.id, s.name, s.roll_no, s.division, s.batch, s.user_id)));
      results.students = students.length;
    }

    // 3. Migrate Timetable
    const { data: timetable } = await supabase.from('timetable').select('*');
    if (timetable) {
      const stmt = DB.prepare("INSERT OR IGNORE INTO timetable (day_of_week, subject_id, division, batch, lecture_no, faculty_id) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(timetable.map(t => stmt.bind(t.day_of_week, t.subject_id, t.division, t.batch, t.lecture_no, t.faculty_id)));
      results.timetable = timetable.length;
    }

    // 4. Migrate Attendance
    const { data: attendance } = await supabase.from('attendance').select('*');
    if (attendance) {
      const stmt = DB.prepare("INSERT OR IGNORE INTO attendance (student_id, subject, date, lecture_no, status, marked_by) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(attendance.map(a => stmt.bind(a.student_id, a.subject, a.date, a.lecture_no, a.status, a.marked_by)));
      results.attendance = attendance.length;
    }

    return new Response(JSON.stringify({ message: "Migration successful", results }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
