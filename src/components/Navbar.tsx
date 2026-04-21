/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, Users, FileBarChart, LogOut, GraduationCap, User, Menu, X, AlertTriangle, UserPlus } from 'lucide-react';
import { cn } from '../utils/attendance';
import type { Profile } from '../types';

interface NavbarProps {
  onLogout: () => void;
  profile: Profile;
}

export default function Navbar({ onLogout, profile }: NavbarProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const facultyItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/attendance', label: 'Attendance', icon: ClipboardCheck },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/report', label: 'Reports', icon: FileBarChart },
  ];

  if (profile.role === 'admin') {
    facultyItems.push({ path: '/admin', label: 'Admin', icon: UserPlus });
  }

  const studentItems = [
    { path: '/', label: 'My Attendance', icon: Users },
  ];

  const navItems = (profile.role === 'faculty' || profile.role === 'admin') ? facultyItems : studentItems;

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
    setIsMobileMenuOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <>
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 mr-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link to="/" className="flex items-center space-x-2 group">
                <div className="bg-blue-600 p-1.5 rounded-lg group-hover:bg-blue-500 transition-colors">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold tracking-tight">EduMark</span>
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                        : "text-slate-300 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-bold text-white leading-none">{profile.full_name || 'User'}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                  {profile.role} {profile.roll_no ? `(${profile.roll_no})` : ''}
                </span>
              </div>
              <button
                onClick={handleLogoutClick}
                className="hidden md:flex items-center space-x-2 px-3 py-2 md:px-4 rounded-lg text-sm font-medium text-slate-300 hover:text-rose-400 hover:bg-slate-800 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-slate-800 space-y-2 animate-in slide-in-from-top-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
                        : "text-slate-300 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-all duration-200 mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>

              <div className="pt-4 mt-2 border-t border-slate-800 sm:hidden px-4">
                <p className="text-xs font-bold text-white">{profile.full_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
                  {profile.role} {profile.roll_no ? `(${profile.roll_no})` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 mb-4 mx-auto">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Confirm Logout</h3>
            <p className="text-center text-slate-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
