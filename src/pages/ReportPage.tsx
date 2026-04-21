/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Download, FileText, Search, Users, ChevronDown, Calendar } from 'lucide-react';
import type { Student } from '../types';
import { SUBJECTS, DIVISIONS, type DivisionId } from '../constants';
import { calculateTWAS, cn } from '../utils/attendance';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportPageProps {
  students: Student[];
}

export default function ReportPage({ students }: ReportPageProps) {
  const [selectedDivision, setSelectedDivision] = useState<DivisionId>('A');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDivDropdownOpen, setIsDivDropdownOpen] = useState(false);
  const divDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (divDropdownRef.current && !divDropdownRef.current.contains(event.target as Node)) {
        setIsDivDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const studentReports = useMemo(() => {
    const filteredStudents = students.filter(
      (s) =>
        s.division === selectedDivision &&
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.rollNo.toLowerCase().includes(searchQuery.toLowerCase())),
    );

    return filteredStudents.map((student) => {
      const subjectStats = SUBJECTS.map((sub) => {
        let records = student.attendance[sub] || [];
        // Feature 5: filter records by date range
        if (dateFrom) records = records.filter(r => r.date >= dateFrom);
        if (dateTo) records = records.filter(r => r.date <= dateTo);
        const { score, status } = calculateTWAS(records);
        return { subject: sub, score, status, totalLectures: records.length };
      });

      let allRecords = Object.values(student.attendance).flat();
      if (dateFrom) allRecords = allRecords.filter(r => r.date >= dateFrom);
      if (dateTo) allRecords = allRecords.filter(r => r.date <= dateTo);
      const { score: avgScore, status: overallStatus } = calculateTWAS(allRecords);

      return { ...student, subjectStats, avgScore, overallStatus };
    });
  }, [students, selectedDivision, searchQuery, dateFrom, dateTo]);

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadCSV = (student: any) => {
    const headers = ['Subject', 'Score (%)', 'Status', 'Total Lectures Recorded'];
    const rows = student.subjectStats.map((s: any) => [
      s.subject,
      s.score.toFixed(2),
      s.status,
      s.totalLectures,
    ]);

    const csvContent = [
      [`Report for ${student.name} (${student.rollNo})`].map(escapeCSV),
      [`Overall Average: ${student.avgScore.toFixed(2)}%`].map(escapeCSV),
      [],
      headers.map(escapeCSV),
      ...rows.map((row: any[]) => row.map(escapeCSV)),
    ]
      .map((e) => e.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `EduMark_Report_${student.rollNo}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = (student: any) => {
    const doc = new jsPDF();
    const headers = [['Subject', 'Score (%)', 'Status', 'Total Lectures Recorded']];
    const rows = student.subjectStats.map((s: any) => [
      s.subject,
      s.score.toFixed(2),
      s.status,
      s.totalLectures,
    ]);

    doc.setFontSize(20);
    doc.text(`EduMark Student Report`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Name: ${student.name}`, 14, 32);
    doc.text(`Roll No: ${student.rollNo}`, 14, 38);
    doc.text(`Division: ${student.division}`, 14, 44);
    doc.text(`Overall Average: ${student.avgScore.toFixed(2)}%`, 14, 50);

    autoTable(doc, {
      startY: 56,
      head: headers,
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [0, 112, 243] },
      alternateRowStyles: { fillColor: [245, 244, 241] }
    });

    doc.save(`EduMark_Report_${student.rollNo}.pdf`);
  };

  const downloadAllCSV = () => {
    const headers = [
      'Roll No',
      'Name',
      'Division',
      'Overall Average (%)',
      'Overall Status',
      ...SUBJECTS.map((sub) => `${sub} (%)`),
    ];

    const rows = studentReports.map((student) => {
      const subjectScores = SUBJECTS.map((sub) => {
        const stat = student.subjectStats.find((s: any) => s.subject === sub);
        return stat ? stat.score.toFixed(2) : '0.00';
      });

      return [
        student.rollNo,
        student.name,
        student.division,
        student.avgScore.toFixed(2),
        student.overallStatus,
        ...subjectScores,
      ];
    });

    const csvContent = [
      [`EduMark Division ${selectedDivision} Report`].map(escapeCSV),
      [],
      headers.map(escapeCSV),
      ...rows.map((row) => row.map(escapeCSV)),
    ]
      .map((e) => e.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `EduMark_Div_${selectedDivision}_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Excellent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 border-emerald-200',
      Good: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 border-blue-200',
      Risky: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 border-orange-200',
      Critical: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 border-rose-200',
    };
    return map[status] || 'bg-cream text-ink border-cream-border';
  };

  return (
    <div className="space-y-10">
      {/* Masthead */}
      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Reports</p>
            <h1 className="font-sans text-3xl md:text-4xl font-semibold text-ink mt-2 tracking-tight text-balance">
              Class reports &amp;{' '}
              <span className="text-ochre">exports</span>
            </h1>
            <p className="text-ink-muted mt-3 max-w-xl leading-relaxed text-sm sm:text-base">
              Download attendance and behaviour Tier summaries for each division.
            </p>
          </div>
          <button
            onClick={downloadAllCSV}
            className="bg-ochre hover:bg-ochre-deep text-white px-5 py-3 rounded-xl font-semibold shadow-[0_8px_24px_-8px_rgba(37,99,235,0.45)] flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Division {selectedDivision}</span>
          </button>
        </div>
        <div className="rule-paper" />
      </header>

      <div className="bg-card rounded-3xl border border-cream-border overflow-hidden">
        {/* Filter bar */}
        <div className="p-5 border-b border-cream-border bg-paper flex flex-col gap-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative w-full md:w-56" ref={divDropdownRef}>
              <button
                onClick={() => setIsDivDropdownOpen(!isDivDropdownOpen)}
                className={cn(
                  'w-full flex items-center justify-between pl-4 pr-4 py-2.5 bg-card border rounded-xl focus:outline-none transition-all',
                  isDivDropdownOpen
                    ? 'border-ochre shadow-[0_0_0_4px_rgba(29,78,216,0.08)] ring-4 ring-ochre/10'
                    : 'border-cream-border hover:border-ochre/50',
                )}
              >
                <div className="flex items-center gap-3">
                  <Users className={cn('w-[18px] h-[18px] transition-colors', isDivDropdownOpen ? 'text-ochre' : 'text-ink/40')} />
                  <span className="font-medium text-ink">Division {selectedDivision}</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-ink/40 transition-transform duration-200', isDivDropdownOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isDivDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 right-0 z-50 mt-2 py-2 bg-card border border-cream-border rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] backdrop-blur-xl overflow-hidden"
                  >
                    {DIVISIONS.map((div) => (
                      <button
                        key={div}
                        onClick={() => {
                          setSelectedDivision(div);
                          setIsDivDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-[0.875rem] font-medium transition-colors',
                          selectedDivision === div
                            ? 'bg-ochre/10 text-ochre-deep'
                            : 'text-ink hover:bg-cream-soft',
                        )}
                      >
                        {selectedDivision === div && (
                          <span className="w-1.5 h-1.5 rounded-full bg-ochre shrink-0" />
                        )}
                        <span className={selectedDivision !== div ? 'ml-[14px]' : ''}>Division {div}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports…"
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-cream-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink placeholder:text-ink/30"
              />
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 text-[0.75rem] font-semibold text-ink-muted">
              <Calendar className="w-3.5 h-3.5 text-ochre" />
              <span>Period</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 sm:max-w-[160px] px-3 py-2 bg-card border border-cream-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
                placeholder="From"
              />
              <span className="text-ink-muted text-sm">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 sm:max-w-[160px] px-3 py-2 bg-card border border-cream-border rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-ochre/10 focus:border-ochre/60 font-medium text-ink"
                placeholder="To"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-[0.75rem] font-semibold text-ochre-deep hover:text-ochre bg-ochre/10 hover:bg-ochre/15 px-3 py-2 rounded-lg border border-ochre/20 transition-colors"
              >
                Clear dates
              </button>
            )}
            {(dateFrom || dateTo) && (
              <span className="text-[0.6875rem] text-ink-muted font-medium px-2 py-1 bg-cream border border-cream-border rounded-lg">
                {dateFrom || '…'} to {dateTo || '…'}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-paper border-b border-cream-border">
                <th className="px-6 py-4 eyebrow">Student</th>
                <th className="px-6 py-4 eyebrow">Roll No</th>
                <th className="px-6 py-4 eyebrow">Avg. TWAS</th>
                <th className="px-6 py-4 eyebrow">Status</th>
                <th className="px-6 py-4 eyebrow text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-border">
              {studentReports.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-16 text-center text-ink-muted"
                  >
                    No students to report on in this view.
                  </td>
                </tr>
              ) : (
                studentReports.map((report, idx) => (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-paper group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-cream border border-cream-border flex items-center justify-center text-ink font-semibold text-sm">
                          {report.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-ink">
                          {report.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-ink-muted tabular-nums">
                      {report.rollNo}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-cream rounded-full max-w-[80px] overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              report.avgScore >= 70
                                ? 'bg-emerald-500'
                                : report.avgScore >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-rose-500',
                            )}
                            style={{ width: `${report.avgScore}%` }}
                          />
                        </div>
                        <span className="font-sans text-base font-semibold text-ink tabular-nums">
                          {report.avgScore.toFixed(0)}
                          <span className="text-ink-muted text-sm">%</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.15em] border',
                          statusBadge(report.overallStatus),
                        )}
                      >
                        {report.overallStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadCSV(report)}
                          className="inline-flex items-center gap-1.5 text-ink font-semibold text-[0.75rem] bg-paper hover:bg-ochre/10 hover:text-ochre-deep border border-cream-border hover:border-ochre/30 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Download CSV"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                        <button
                          onClick={() => downloadPDF(report)}
                          className="inline-flex items-center gap-1.5 text-white font-semibold text-[0.75rem] bg-ochre hover:bg-ochre-deep px-2.5 py-1.5 rounded-lg shadow-sm transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
