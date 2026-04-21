/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Search, User, Calendar, AlertCircle, TrendingUp, ChevronRight, BookOpen, Users, List, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Student } from '../types';
import { SUBJECTS, DIVISIONS, type SubjectId, type DivisionId } from '../constants';
import { calculateTWAS, getStatusColor, cn } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import { AttendanceLogs } from '../components/AttendanceLogs';

interface StudentPageProps {
  students: Student[];
  isStudentView?: boolean;
  isLoading?: boolean;
}

export default function StudentPage({ students, isStudentView, isLoading }: StudentPageProps) {
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [showStudentLogs, setShowStudentLogs] = useState(false);
  
  // Filter students by division first (only for faculty)
  const divisionStudents = useMemo(() => 
    isStudentView ? students : students.filter(s => s.division === selectedDivision),
    [students, selectedDivision, isStudentView]
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string>(divisionStudents[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedStudent = useMemo(() => 
    isStudentView ? students[0] : divisionStudents.find(s => s.id === selectedStudentId), 
    [divisionStudents, selectedStudentId, isStudentView, students]
  );

  const filteredStudents = divisionStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const studentStats = useMemo(() => {
    if (!selectedStudent) return null;

    let records: typeof selectedStudent.attendance[SubjectId] = [];
    
    if (selectedSubject === 'All') {
      // Aggregate records from all subjects
      records = Object.values(selectedStudent.attendance).flat();
    } else {
      records = selectedStudent.attendance[selectedSubject] || [];
    }

    const twas = calculateTWAS(records);
    
    // Last 5 absences
    const lastAbsences = records
      .filter(r => r.status === 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    // Chart data: Rolling average or just status
    // Let's do a rolling TWAS for the line chart
    const chartData = [...records]
      .sort((a, b) => a.date.localeCompare(b.date) || a.lectureNo - b.lectureNo)
      .map((_, idx, arr) => {
        const slice = arr.slice(0, idx + 1);
        const { score } = calculateTWAS(slice);
        return {
          name: `L${idx + 1}`,
          score: Math.round(score),
          date: arr[idx].date
        };
      })
      .slice(-10); // Last 10 records

    return { twas, lastAbsences, chartData };
  }, [selectedStudent, selectedSubject]);

  return (
    <div className={cn(
      "grid grid-cols-1 gap-8 h-[calc(100vh-12rem)]",
      !isStudentView && "lg:grid-cols-12"
    )}>
      {/* Sidebar */}
      {!isStudentView && (
        <div className="lg:col-span-4 flex flex-col space-y-4 h-full">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Users className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <select
              value={selectedDivision}
              onChange={(e) => {
                const div = e.target.value as DivisionId;
                setSelectedDivision(div);
                // Reset selected student when division changes
                const firstInDiv = students.find(s => s.division === div);
                if (firstInDiv) setSelectedStudentId(firstInDiv.id);
              }}
              className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
            >
              {DIVISIONS.map(div => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-bottom border-slate-50 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Student Directory</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group",
                    selectedStudentId === student.id 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                      : "hover:bg-slate-50 text-slate-700"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold",
                      selectedStudentId === student.id ? "bg-white/20" : "bg-slate-100 text-slate-500"
                    )}>
                      {student.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm leading-tight">{student.name}</p>
                      <p className={cn("text-[10px] font-medium", selectedStudentId === student.id ? "text-blue-100" : "text-slate-400")}>
                        {student.rollNo}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 transition-transform", selectedStudentId === student.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
                </button>
              ))}
            </div>
          </div>
          <div className="h-72 shrink-0">
            <AttendanceLogs students={students} compact={true} className="h-full" />
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className={cn(
        "h-full overflow-y-auto pr-2",
        !isStudentView ? "lg:col-span-8" : "max-w-4xl mx-auto w-full"
      )}>
        <AnimatePresence mode="wait">
          {selectedStudent ? (
            <motion.div
              key={selectedStudent.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-slate-900/20">
                      {selectedStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{selectedStudent.name}</h2>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="flex items-center text-sm font-medium text-slate-500">
                          <User className="w-4 h-4 mr-1.5 text-blue-500" />
                          {selectedStudent.rollNo}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="flex items-center text-sm font-medium text-slate-500">
                          <BookOpen className="w-4 h-4 mr-1.5 text-blue-500" />
                          Computer Science
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4 md:mt-0">
                    <button
                      onClick={() => setShowStudentLogs(!showStudentLogs)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border",
                        showStudentLogs 
                          ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <List className="w-4 h-4" />
                      <span>{showStudentLogs ? 'Hide Logs' : 'View Logs'}</span>
                    </button>
                    
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest px-3">Subject</span>
                      <div className="relative">
                        <select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value as SubjectId | 'All')}
                          className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer shadow-sm"
                        >
                          <option value="All">All Subjects</option>
                          {SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {showStudentLogs ? (
                  <div className="mt-10 h-96">
                    <AttendanceLogs students={students} studentId={selectedStudent.id} className="h-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">TWAS Score</p>
                      <p className={cn("text-5xl font-black mb-2", studentStats?.twas.score! < 70 ? "text-rose-600" : "text-blue-600")}>
                        {studentStats?.twas.score.toFixed(0)}%
                      </p>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                        getStatusColor(studentStats?.twas.status!)
                      )}>
                        {studentStats?.twas.status}
                      </span>
                    </div>

                    <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance Trend</p>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={studentStats?.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="score" 
                              stroke="#2563eb" 
                              strokeWidth={3} 
                              dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!showStudentLogs && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2 text-rose-500" />
                      Recent Absences
                    </h3>
                  </div>
                  {studentStats?.lastAbsences.length! > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {studentStats?.lastAbsences.map((abs, idx) => (
                        <div key={idx} className="flex items-center space-x-4 p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                          <div className="bg-rose-100 p-2 rounded-xl">
                            <Calendar className="w-5 h-5 text-rose-600" />
                          </div>
                          <div>
                            <p className="font-bold text-rose-900">{new Date(abs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-xs font-medium text-rose-600">Lecture #{abs.lectureNo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-500 font-medium">No recent absences recorded {selectedSubject === 'All' ? 'across all subjects' : 'for this subject'}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              {isStudentView ? (
                isLoading ? (
                  <>
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <h2 className="text-2xl font-bold text-slate-900">Loading Data</h2>
                    <p className="text-slate-500 mt-2 max-w-xs">Fetching your attendance records...</p>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-6">
                      <AlertCircle className="w-12 h-12 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Record Not Found</h2>
                    <p className="text-slate-500 mt-2 max-w-xs">We couldn't find your student record. Please ensure your roll number is correctly registered in the system.</p>
                  </>
                )
              ) : (
                <>
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <User className="w-12 h-12 text-slate-300" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">Select a Student</h2>
                  <p className="text-slate-500 mt-2 max-w-xs">Choose a student from the directory to view their detailed performance and attendance analytics.</p>
                </>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
