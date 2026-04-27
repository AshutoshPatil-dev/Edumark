import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import MissingAttendanceAlert from './components/MissingAttendanceAlert';
import { SyncProvider } from './context/SyncContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const StudentPage = lazy(() => import('./pages/StudentPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage'));

function AppContent() {
  const { isAuthChecking, isLoggedIn, profile, profileError, handleLogout, setIsLoggedIn } = useAuth();
  const { students, isLoading, fetchStudents } = useData();

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

  return (
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
  );
}

export default function App() {
  return (
    <SyncProvider>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </SyncProvider>
  );
}
