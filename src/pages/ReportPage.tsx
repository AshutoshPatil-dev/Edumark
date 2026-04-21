/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Download, FileText, Search, Filter, ChevronRight, Users, ChevronDown } from 'lucide-react';
import type { Student } from '../types';
import { SUBJECTS, DIVISIONS, type DivisionId } from '../constants';
import { calculateTWAS, getStatusColor, cn } from '../utils/attendance';
import { motion } from 'motion/react';

interface ReportPageProps {
  students: Student[];
}

export default function ReportPage({ students }: ReportPageProps) {
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [searchQuery, setSearchQuery] = useState('');

  const studentReports = useMemo(() => {
    const filteredStudents = students.filter(s => 
      s.division === selectedDivision &&
      (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return filteredStudents.map(student => {
      const subjectStats = SUBJECTS.map(sub => {
        const records = student.attendance[sub] || [];
        const { score, status } = calculateTWAS(records);
        return { subject: sub, score, status, totalLectures: records.length };
      });

      const allRecords = Object.values(student.attendance).flat();
      const { score: avgScore, status: overallStatus } = calculateTWAS(allRecords);

      return {
        ...student,
        subjectStats,
        avgScore,
        overallStatus
      };
    });
  }, [students, selectedDivision, searchQuery]);

  const downloadCSV = (student: any) => {
    const headers = ['Subject', 'Score (%)', 'Status', 'Total Lectures Recorded'];
    const rows = student.subjectStats.map((s: any) => [
      s.subject,
      s.score.toFixed(2),
      s.status,
      s.totalLectures
    ]);

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      [`Report for ${student.name} (${student.rollNo})`].map(escapeCSV),
      [`Overall Average: ${student.avgScore.toFixed(2)}%`].map(escapeCSV),
      [],
      headers.map(escapeCSV),
      ...rows.map(row => row.map(escapeCSV))
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `EduMark_Report_${student.rollNo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllCSV = () => {
    const headers = ['Roll No', 'Name', 'Division', 'Overall Average (%)', 'Overall Status', ...SUBJECTS.map(sub => `${sub} (%)`)];
    
    const rows = studentReports.map(student => {
      const subjectScores = SUBJECTS.map(sub => {
        const stat = student.subjectStats.find((s: any) => s.subject === sub);
        return stat ? stat.score.toFixed(2) : '0.00';
      });
      
      return [
        student.rollNo,
        student.name,
        student.division,
        student.avgScore.toFixed(2),
        student.overallStatus,
        ...subjectScores
      ];
    });

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      [`EduMark Division ${selectedDivision} Report`].map(escapeCSV),
      [],
      headers.map(escapeCSV),
      ...rows.map(row => row.map(escapeCSV))
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `EduMark_Div_${selectedDivision}_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Academic Reports</h1>
          <p className="text-slate-500 mt-1">Export attendance data and performance summaries</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={downloadAllCSV}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-900/20 flex items-center space-x-2 hover:bg-slate-800 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export All (Div {selectedDivision})</span>
          </button>
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-48 group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Users className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value as DivisionId)}
              className="w-full pl-12 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
            >
              {DIVISIONS.map(div => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <ChevronDown className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Roll No</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. TWAS</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {studentReports.map((report, idx) => (
                <motion.tr 
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                        {report.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{report.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">{report.rollNo}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[60px] overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full",
                            report.avgScore >= 70 ? "bg-emerald-500" : report.avgScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${report.avgScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{report.avgScore.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                      getStatusColor(report.overallStatus)
                    )}>
                      {report.overallStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => downloadCSV(report)}
                      className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      <span>CSV</span>
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
