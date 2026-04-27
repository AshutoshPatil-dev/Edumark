import { supabase } from '../lib/supabase';

export const studentService = {
  getStudents: async (role: string, rollNo?: string | null) => {
    let query = supabase.from('students').select('*');
    if (role === 'student' && rollNo) {
      query = query.eq('roll_no', rollNo);
    }
    return await query;
  },
  getAttendance: async (role: string, studentId?: string) => {
    let query = supabase.from('attendance').select('*');
    if (role === 'student' && studentId) {
      query = query.eq('student_id', studentId);
    }
    return await query;
  }
};
