import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/auth.service';
import type { Profile } from '../types';

interface AuthContextType {
  isLoggedIn: boolean;
  profile: Profile | null;
  profileError: string | null;
  isAuthChecking: boolean;
  handleLogout: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const handleLogout = async () => {
    await authService.signOut();
    localStorage.removeItem('edumark_last_activity');
    setIsLoggedIn(false);
    setProfile(null);
    setProfileError(null);
  };

  const fetchProfile = async (userId: string) => {
    setProfileError(null);
    const { data: profileData, error: profileError } = await authService.getProfile(userId);

    if (profileData && !profileError) {
      setProfile({
        id: profileData.id,
        role: profileData.role,
        full_name: profileData.full_name,
        assigned_subjects: profileData.assigned_subjects || [],
        roll_no: profileData.roll_no
      });
      return;
    }

    const { data: studentData, error: studentError } = await authService.getStudentProfile(userId);

    if (studentData && !studentError) {
      setProfile({
        id: userId,
        role: 'student',
        full_name: studentData.name,
        assigned_subjects: [],
        roll_no: studentData.roll_no
      });
      return;
    }

    setProfileError("We couldn't find an account linked to your login. Please contact your administrator to set up your profile.");
  };

  useEffect(() => {
    authService.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsAuthChecking(false);
    });

    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
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

  useEffect(() => {
    if (!isLoggedIn) return;
    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT = 15 * 60 * 1000;
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
          handleLogout();
          alert('You have been automatically logged out due to inactivity.');
        }
      }, INACTIVITY_LIMIT);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove', 'touchend'];
    let isThrottled = false;
    const handleActivity = () => {
      if (!isThrottled) {
        resetTimer();
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 1000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkTimeout();
    };

    events.forEach(event => document.addEventListener(event, handleActivity));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkTimeout);

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkTimeout);
    };
  }, [isLoggedIn]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, profile, profileError, isAuthChecking, handleLogout, setProfile, setIsLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
