import { supabase } from '../lib/supabase';

export const authService = {
  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
  getProfile: async (userId: string) => {
    return await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
  },
  getStudentProfile: async (userId: string) => {
    return await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();
  }
};
