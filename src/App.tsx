/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Student, Profile } from './types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import StudentPage from './pages/StudentPage';
import Navbar from './components/Navbar';
import MissingAttendanceAlert from './components/MissingAttendanceAlert';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import InstitutionOnboarding from './pages/InstitutionOnboarding';
import { InstitutionProvider } from './context/InstitutionContext';
import { SyncProvider } from './context/SyncContext';
import { supabase } from './lib/supabase';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SetPasswordModal from './components/SetPasswordModal';

// Lazy load heavy pages
const ReportPage = lazy(() => import('./pages/ReportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));


export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [requiresPasswordSetup, setRequiresPasswordSetup] = useState(false);

  const fetchProfile = async (userId: string) => {
    setProfileError(null);

    // First try to fetch a faculty profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) console.warn('Profile fetch error:', profileError);

    if (profileData && !profileError) {
      setProfile({
        id: profileData.id,
        role: profileData.role,
        full_name: profileData.full_name,
        assigned_subjects: profileData.assigned_subjects || [],
        roll_no: profileData.roll_no,
        institution_id: profileData.institution_id || null,
      });
      return;
    }

    // If no profile, check if they are a student linked via user_id
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (studentError) console.warn('Student fetch error:', studentError);

    if (studentData && !studentError) {
      setProfile({
        id: userId,
        role: 'student',
        full_name: studentData.name,
        assigned_subjects: [],
        roll_no: studentData.roll_no,
        institution_id: studentData.institution_id || null,
      });
      return;
    }

    console.error('Error fetching profile:', profileError, studentError);
    setProfileError("We couldn't find an account linked to your login. Please contact your administrator to set up your profile.");
  };

  useEffect(() => {
    // Check hash on mount to detect invites or password recoveries
    // The hash was captured by index.html before Supabase cleared it
    if (window.sessionStorage.getItem('requires_password_setup') === 'true') {
      setRequiresPasswordSetup(true);
      window.sessionStorage.removeItem('requires_password_setup');
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsAuthChecking(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('edumark_last_activity');
        setIsLoggedIn(false);
        setProfile(null);
        setProfileError(null);
      } else if (event === 'SIGNED_IN') {
        localStorage.setItem('edumark_last_activity', Date.now().toString());
        setIsLoggedIn(true);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchStudents = async () => {
    if (!isLoggedIn || !profile) return;
    setIsLoading(true);
    
    try {
      // Fetch students and attendance from Supabase
      let studentsQuery = supabase.from('students').select('*');
      let attendanceQuery = supabase.from('attendance').select('*');

      if (profile.institution_id) {
        studentsQuery = studentsQuery.eq('institution_id', profile.institution_id);
        attendanceQuery = attendanceQuery.eq('institution_id', profile.institution_id);
      } else if (profile.role !== 'super_admin') {
        // Security: If a user has no institution assigned yet, DO NOT fetch all students.
        setStudents([]);
        setIsLoading(false);
        return;
      }

      // If student, only fetch their own data
      if (profile.role === 'student' && profile.roll_no) {
        studentsQuery = studentsQuery.eq('roll_no', profile.roll_no);
      }

      const { data: studentsData, error: studentsError } = await studentsQuery;
      
      if (studentsError) throw studentsError;

      if (studentsData && studentsData.length > 0) {
        if (profile.role === 'student') {
          // Filter attendance by this student's ID
          attendanceQuery = attendanceQuery.eq('student_id', studentsData[0].id);
        }

        const { data: attendanceData, error: attendanceError } = await attendanceQuery;
        if (attendanceError) throw attendanceError;

        const formattedStudents: Student[] = studentsData.map(s => ({
          id: s.id,
          name: s.name,
          rollNo: s.roll_no,
          division: s.division || 'A', // Fallback to 'A' if null
          batch: s.batch,
          attendance: {}
        })).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true, sensitivity: 'base' }));

        if (attendanceData) {
          const studentMap = new Map<string, Student>();
          formattedStudents.forEach(s => studentMap.set(s.id, s));

          attendanceData.forEach(record => {
            const student = studentMap.get(record.student_id);
            if (student) {
              if (!student.attendance[record.subject]) {
                student.attendance[record.subject] = [];
              }
              student.attendance[record.subject].push({
                date: record.date,
                lectureNo: record.lecture_no,
                status: record.status as 0 | 1,
                marked_by: record.marked_by
              });
            }
          });
        }
        setStudents(formattedStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && profile) {
      fetchStudents();
    }
  }, [isLoggedIn, profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('edumark_last_activity');
    setIsLoggedIn(false);
    setProfile(null);
    setProfileError(null);
    setStudents([]);
  };

  // Auto-logout due to inactivity
  useEffect(() => {
    if (!isLoggedIn) return;

    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds
    const STORAGE_KEY = 'edumark_last_activity';

    const checkTimeout = () => {
      const lastActivity = localStorage.getItem(STORAGE_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_LIMIT) {
          handleLogout();
          alert('You have been automatically logged out due to inactivity.');
          return true;
        }
      }
      return false;
    };

    const resetTimer = () => {
      if (checkTimeout()) return;

      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!checkTimeout()) {
          // If checkTimeout didn't log out (e.g. limit changed), force it
          handleLogout();
          alert('You have been automatically logged out due to inactivity.');
        }
      }, INACTIVITY_LIMIT);
    };

    // Initialize timer and check for existing timeout
    resetTimer();

    // Events to track for activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove', 'touchend'];
    
    let isThrottled = false;
    const handleActivity = () => {
      if (!isThrottled) {
        resetTimer();
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 1000); // Throttle to once per second
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimeout();
      }
    };

    const handleOnline = () => {
      // Check if we should have logged out while offline
      checkTimeout();
    };

    events.forEach(event => document.addEventListener(event, handleActivity));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [isLoggedIn]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-[3px] border-ink/15 border-t-ochre rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => {
      localStorage.setItem('edumark_last_activity', Date.now().toString());
      setIsLoggedIn(true);
    }} />;
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
        <div className="bg-card p-10 rounded-3xl shadow-[0_1px_0_rgba(11,15,25,0.04),0_20px_40px_-20px_rgba(11,15,25,0.08)] border border-cream-border max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-cream text-ink rounded-2xl flex items-center justify-center mx-auto mb-2 border border-cream-border">
            <AlertCircle className="w-7 h-7" />
          </div>
          <p className="eyebrow">Access Issue</p>
          <h2 className="font-sans text-2xl font-semibold text-ink tracking-tight">Profile not found</h2>
          <p className="text-ink-muted leading-relaxed">{profileError}</p>
          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-night hover:bg-night-soft text-white font-semibold py-3 px-4 rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-[3px] border-ink/15 border-t-ochre rounded-full animate-spin" />
          <p className="eyebrow">Loading your profile</p>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin' && !profile.institution_id) {
    return (
      <div className="min-h-screen bg-paper font-sans text-ink selection:bg-ochre/20 selection:text-ochre-deep">
        <InstitutionOnboarding 
          profileId={profile.id} 
          onComplete={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await fetchProfile(user.id);
          }} 
        />
      </div>
    );
  }

  return (
    <SyncProvider>
      <InstitutionProvider institutionId={profile.institution_id}>
        <Router>
          <div className="min-h-screen bg-transparent flex flex-col">
            <Navbar onLogout={handleLogout} profile={profile} />
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-10 max-w-7xl">
              {!isLoading && <MissingAttendanceAlert students={students} profile={profile} refreshData={fetchStudents} />}
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-[3px] border-ink/15 border-t-ochre rounded-full animate-spin" />
                </div>
              }>
                <Routes>
                  {profile.role === 'super_admin' ? (
                    <>
                      <Route path="/" element={<SuperAdminDashboard />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                  ) : (profile.role === 'faculty' || profile.role === 'admin') ? (
                    <>
                      <Route path="/" element={<DashboardPage students={students} />} />
                      <Route 
                        path="/attendance" 
                        element={<AttendancePage students={students} refreshData={fetchStudents} profile={profile} />} 
                      />
                      <Route path="/students" element={<StudentPage students={students} isLoading={isLoading} />} />
                      <Route path="/report" element={<ReportPage students={students} />} />
                      <Route path="/leaves" element={<LeaveRequestsPage profile={profile} />} />
                      {profile.role === 'admin' && (
                        <Route path="/admin" element={<AdminPage refreshData={fetchStudents} />} />
                      )}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                  ) : (
                    <>
                      <Route path="/" element={<StudentPage students={students.filter(s => s.rollNo === profile.roll_no)} isStudentView={true} isLoading={isLoading} />} />
                      <Route path="/leaves" element={<LeaveRequestsPage profile={profile} studentId={students.find(s => s.rollNo === profile.roll_no)?.id} />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                  )}
                </Routes>
              </Suspense>
            </main>
            {requiresPasswordSetup && <SetPasswordModal onClose={() => setRequiresPasswordSetup(false)} />}
          </div>
        </Router>
      </InstitutionProvider>
    </SyncProvider>
  );
}


