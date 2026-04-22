/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { SyncProvider } from './context/SyncContext';

// Lazy load heavy pages
const ReportPage = lazy(() => import('./pages/ReportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage'));


export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError] = useState<string | null>(null);

  useEffect(() => {
    // Check local session
    const token = localStorage.getItem('edumark_token');
    const userData = localStorage.getItem('edumark_user');

    if (token && userData) {
      const user = JSON.parse(userData);
      setIsLoggedIn(true);
      setProfile({
        id: user.id,
        role: user.role,
        full_name: user.fullName,
        assigned_subjects: [], // Will be fetched if needed
        roll_no: user.rollNo
      });
    }
    
    setIsAuthChecking(false);

    // Listen for storage changes (optional, handles logout across tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'edumark_token' && !e.newValue) {
        setIsLoggedIn(false);
        setProfile(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchStudents = async () => {
    if (!isLoggedIn || !profile) return;
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/students');
      if (!response.ok) throw new Error('Failed to fetch students');
      
      const data = await response.json();
      setStudents(data);
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
    localStorage.removeItem('edumark_token');
    localStorage.removeItem('edumark_user');
    localStorage.removeItem('edumark_last_activity');
    setIsLoggedIn(false);
    setProfile(null);
    setProfileError(null);
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
      const userData = localStorage.getItem('edumark_user');
      if (userData) {
        const user = JSON.parse(userData);
        setProfile({
          id: user.id,
          role: user.role,
          full_name: user.fullName,
          assigned_subjects: [],
          roll_no: user.rollNo
        });
      }
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

  return (
    <SyncProvider>
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
                {(profile.role === 'faculty' || profile.role === 'admin') ? (
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
        </div>
      </Router>
    </SyncProvider>
  );
}

