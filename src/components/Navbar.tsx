/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import { Link, useLocation } from 'react-router-dom';
import { useInstitution } from '../context/InstitutionContext';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  FileBarChart,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  UserPlus,
  FileText,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { cn } from '../utils/attendance';
import type { Profile } from '../types';
import EdumarkLogo from './EdumarkLogo';

interface NavbarProps {
  onLogout: () => void;
  profile: Profile;
}

export default function Navbar({ onLogout, profile }: NavbarProps) {
  const { theme } = useTheme();
  const { institution } = useInstitution();
  const { isOnline, pendingCount, syncNow } = useSync();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const facultyItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/attendance', label: 'Mark', icon: ClipboardCheck },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/report', label: 'Reports', icon: FileBarChart },
    { path: '/leaves', label: 'Leaves', icon: FileText },
  ];

  let navItems: { path: string; label: string; icon: any }[] = [];
  
  if (profile.role === 'super_admin') {
    navItems = [{ path: '/', label: 'Operations', icon: LayoutDashboard }];
  } else if (profile.role === 'faculty' || profile.role === 'admin') {
    navItems = [...facultyItems];
    if (profile.role === 'admin') {
      navItems.push({ path: '/admin', label: 'Admin', icon: UserPlus });
    }
  } else {
    navItems = studentItems;
  }

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    setIsMobileMenuOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if ((window as any).hasUnsavedAttendanceChanges) {
      if (!window.confirm('You have unsaved attendance changes. If you leave, your changes will be lost. Do you want to proceed?')) {
        e.preventDefault();
        return;
      } else {
        (window as any).hasUnsavedAttendanceChanges = false;
      }
    }
    setIsMobileMenuOpen(false);
  };

  const initials = (profile.full_name || 'U')
    .split(' ')
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="sticky top-0 z-50 w-full pt-4 pb-2 px-4 sm:px-6 pointer-events-none">
        <nav className="max-w-7xl mx-auto bg-card/85 text-ink border border-cream-border/80 shadow-md shadow-ink/5 backdrop-blur-xl rounded-2xl pointer-events-auto transition-all">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14 sm:h-[60px]">
              <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation"
                className="md:hidden p-2 -ml-2 text-ink-muted hover:text-ink hover:bg-cream-soft rounded-lg"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              <Link to="/" onClick={handleNavClick} className="flex items-center gap-3 group">
                <EdumarkLogo size={38} variant={theme === 'dark' ? 'light' : 'dark'} />
                <div className="hidden sm:flex flex-col leading-none">
                  <span
                    className="font-sans text-[1.35rem] text-ink tracking-tight"
                    style={{ fontWeight: 600 }}
                  >
                    Edu
                    <span className="text-gradient-cool" style={{ fontWeight: 700 }}>
                      m
                    </span>
                    ark
                  </span>
                  <span className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted mt-1 font-sans truncate max-w-[150px]">
                    {institution?.name || 'Class attendance'}
                  </span>
                </div>
              </Link>
            </div>

            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleNavClick}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-xl text-[0.875rem] transition-colors',
                        isActive
                          ? 'bg-ink text-paper shadow-md font-semibold'
                          : 'text-ink-muted hover:text-ink hover:bg-cream-soft font-medium'
                      )}
                    >
                      <Icon className="w-[16px] h-[16px]" strokeWidth={isActive ? 2.5 : 2} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
              {/* Sync Status Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-paper/50 border border-cream-border/50 mr-1">
                {isOnline ? (
                  <div className="flex items-center gap-2">
                    {pendingCount > 0 ? (
                      <button 
                        onClick={() => syncNow()}
                        className="flex items-center gap-1.5 text-ochre hover:text-ochre-deep transition-colors"
                        title={`${pendingCount} records pending sync`}
                      >
                        <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                        <span className="text-[0.65rem] font-bold tabular-nums">{pendingCount}</span>
                      </button>
                    ) : (
                      <Cloud className="w-3.5 h-3.5 text-emerald-500" title="All data synced" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-500" title="You are offline. Changes saved locally.">
                    <CloudOff className="w-3.5 h-3.5" />
                    {pendingCount > 0 && <span className="text-[0.65rem] font-bold tabular-nums">{pendingCount}</span>}
                  </div>
                )}
              </div>

              <ThemeToggle className="shrink-0" />
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-cream-soft transition-colors cursor-pointer">
                <div className="text-right">
                  <span className="block text-[0.8125rem] font-bold text-ink leading-none">
                    {profile.full_name || 'User'}
                  </span>
                  <span className="block text-[0.6875rem] font-medium text-ink-muted uppercase tracking-[0.08em] mt-1">
                    {profile.role}
                    {profile.roll_no ? ` · ${profile.roll_no}` : ''}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-ochre/10 text-ochre-deep flex items-center justify-center font-bold text-[0.8125rem]">
                  {initials}
                </div>
              </div>
              <button
                onClick={handleLogoutClick}
                title="Sign out"
                aria-label="Sign out"
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[0.8125rem] font-medium text-ink-muted hover:text-ink hover:bg-cream-soft"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-cream-border space-y-1 bg-card/95 backdrop-blur-xl rounded-b-2xl px-2 animate-in slide-in-from-top-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium',
                      isActive
                        ? 'bg-gradient-to-r from-ochre/[0.08] to-aqua/[0.07] text-ink border border-ochre/25'
                        : 'text-ink-muted hover:text-ink hover:bg-paper'
                    )}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-paper mt-1"
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span>Sign out</span>
              </button>

              <div className="pt-4 mt-2 border-t border-cream-border sm:hidden px-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-ochre/15 to-aqua/20 text-ochre flex items-center justify-center font-semibold text-sm border border-ochre/25 ring-1 ring-aqua/15">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink leading-none">
                    {profile.full_name || 'User'}
                  </p>
                  <p className="text-[0.625rem] uppercase tracking-[0.12em] text-ink-muted mt-1.5">
                    {profile.role}
                    {profile.roll_no ? ` · ${profile.roll_no}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
        </nav>
      </div>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-night/50 backdrop-blur-sm"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-paper rounded-3xl shadow-[0_30px_60px_-20px_rgba(11,15,25,0.35)] max-w-sm w-full p-8 border border-cream-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cream border border-cream-border mb-5 mx-auto">
              <AlertTriangle className="w-5 h-5 text-ochre-deep" />
            </div>
            <p className="eyebrow text-center">Confirm</p>
            <h3 className="font-sans text-xl font-semibold text-center text-ink mt-1 mb-2 tracking-tight">
              Sign out of EduMark?
            </h3>
            <p className="text-center text-ink-muted text-sm mb-7 leading-relaxed">
              You&apos;ll need to sign in again to access your records.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-ink bg-cream hover:bg-cream-soft border border-cream-border"
              >
                Stay
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-ochre hover:bg-ochre-deep"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
