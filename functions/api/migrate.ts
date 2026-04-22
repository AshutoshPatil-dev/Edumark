import { createClient } from '@supabase/supabase-js';

export const onRequest: PagesFunction<{ 
  DB: D1Database; 
  VITE_SUPABASE_URL: string; 
  VITE_SUPABASE_ANON_KEY: string; 
}> = async (context) => {
  const { DB, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = context.env;

  // Debugging info
  const configStatus = {
    hasDb: !!DB,
    hasUrl: !!VITE_SUPABASE_URL,
    hasKey: !!VITE_SUPABASE_ANON_KEY
  };

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ 
      error: "Supabase credentials missing in Cloudflare environment.",
      status: configStatus,
      help: "Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Cloudflare Pages Settings -> Functions -> Environment Variables."
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

  try {
    const results: any = {};

    // 1. Migrate Profiles
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) throw new Error(`Supabase Profiles Fetch Error: ${pErr.message}`);
    if (profiles && profiles.length > 0) {
      const stmt = DB.prepare("INSERT OR REPLACE INTO profiles (id, role, full_name, roll_no, assigned_subjects) VALUES (?, ?, ?, ?, ?)");
      await DB.batch(profiles.map(p => stmt.bind(p.id, p.role, p.full_name, p.roll_no, JSON.stringify(p.assigned_subjects || []))));
      results.profiles = profiles.length;
    }

    // 2. Migrate Students
    const { data: students, error: sErr } = await supabase.from('students').select('*');
    if (sErr) throw new Error(`Supabase Students Fetch Error: ${sErr.message}`);
    if (students && students.length > 0) {
      const stmt = DB.prepare("INSERT OR REPLACE INTO students (id, name, roll_no, division, batch, user_id) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(students.map(s => stmt.bind(s.id, s.name, s.roll_no, s.division, s.batch, s.user_id)));
      results.students = students.length;
    }

    // 3. Migrate Timetable
    const { data: timetable, error: tErr } = await supabase.from('timetable').select('*');
    if (tErr) throw new Error(`Supabase Timetable Fetch Error: ${tErr.message}`);
    if (timetable && timetable.length > 0) {
      const stmt = DB.prepare("INSERT OR REPLACE INTO timetable (day_of_week, subject_id, division, batch, lecture_no, faculty_id) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(timetable.map(t => stmt.bind(t.day_of_week, t.subject_id, t.division, t.batch, t.lecture_no, t.faculty_id)));
      results.timetable = timetable.length;
    }

    // 4. Migrate Attendance
    const { data: attendance, error: aErr } = await supabase.from('attendance').select('*');
    if (aErr) throw new Error(`Supabase Attendance Fetch Error: ${aErr.message}`);
    if (attendance && attendance.length > 0) {
      const stmt = DB.prepare("INSERT OR REPLACE INTO attendance (student_id, subject, date, lecture_no, status, marked_by) VALUES (?, ?, ?, ?, ?, ?)");
      await DB.batch(attendance.map(a => stmt.bind(a.student_id, a.subject, a.date, a.lecture_no, a.status, a.marked_by)));
      results.attendance = attendance.length;
    }

    return new Response(JSON.stringify({ 
      message: "Migration completed successfully!", 
      results,
      note: "Data has been synced from Supabase to Cloudflare D1."
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      hint: "Check if your D1 database is correctly bound as 'DB' in wrangler.toml"
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
