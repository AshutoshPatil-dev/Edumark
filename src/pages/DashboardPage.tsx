/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Users, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight, Filter, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import type { Student } from '../types';
import { calculateTWAS, getStatusColor } from '../utils/attendance';
import { SUBJECTS, DIVISIONS, type DivisionId } from '../constants';
import { motion } from 'motion/react';
import { cn } from '../utils/attendance';

interface DashboardPageProps {
  students: Student[];
}

export default function DashboardPage({ students }: DashboardPageProps) {
  const [selectedDivision, setSelectedDivision] = useState<DivisionId | 'All'>('All');

  const stats = useMemo(() => {
    let totalScore = 0;
    let studentCount = 0;
    let riskCount = 0;
    let healthyCount = 0;
    const behaviourDist = {
      Excellent: 0,
      Good: 0,
      Risky: 0,
      Critical: 0,
    };

    const filteredStudents = selectedDivision === 'All' 
      ? students 
      : students.filter(s => s.division === selectedDivision);

    const atRiskStudents = filteredStudents.map(student => {
      // Calculate overall TWAS across all records
      const allRecords = Object.values(student.attendance).flat();
      const { score: avgScore, status: finalStatus } = calculateTWAS(allRecords);

      behaviourDist[finalStatus]++;
      totalScore += avgScore;
      studentCount++;

      if (finalStatus === 'Risky' || finalStatus === 'Critical') {
        riskCount++;
        return { ...student, avgScore, status: finalStatus };
      } else {
        healthyCount++;
        return null;
      }
    }).filter(s => s !== null) as (Student & { avgScore: number, status: string })[];

    return {
      avgAttendance: studentCount > 0 ? totalScore / studentCount : 0,
      riskCount,
      healthyCount,
      studentCount,
      behaviourData: Object.entries(behaviourDist).map(([name, value]) => ({ name, value })),
      atRiskStudents: atRiskStudents.sort((a, b) => a.avgScore - b.avgScore).slice(0, 5),
    };
  }, [students, selectedDivision]);

  const COLORS = {
    Excellent: '#10b981',
    Good: '#3b82f6',
    Risky: '#f59e0b',
    Critical: '#ef4444',
  };

  const statCards = [
    { label: 'Total Students', value: stats.studentCount, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg. Attendance', value: `${stats.avgAttendance.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'At Risk', value: stats.riskCount, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Healthy', value: stats.healthyCount, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Institutional Overview</h1>
          <p className="text-slate-500 mt-1">Real-time attendance analytics and risk assessment</p>
        </div>
        <div className="relative w-full md:w-48 group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Filter className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value as DivisionId | 'All')}
            className="w-full pl-12 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-slate-700 appearance-none cursor-pointer"
          >
            <option value="All">All Divisions</option>
            {DIVISIONS.map(div => (
              <option key={div} value={div}>Division {div}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4"
          >
            <div className={`${card.bg} p-3 rounded-xl`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Behaviour Distribution</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.behaviourData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                  {stats.behaviourData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">At-Risk Students</h2>
            <Link to="/students" className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-4">
            {stats.atRiskStudents.length > 0 ? (
              stats.atRiskStudents.map((student) => (
                <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.rollNo}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${student.avgScore < 50 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {student.avgScore.toFixed(1)}%
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusColor(student.status as any)}`}>
                      {student.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No students at risk</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
