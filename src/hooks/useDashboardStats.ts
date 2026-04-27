import { useMemo } from 'react';
import type { Student } from '../types';
import { calculateTWAS } from '../utils/attendance';
import { useTheme } from '../context/ThemeContext';

export function useDashboardStats(students: Student[], selectedDivision: string | 'All') {
  const { theme } = useTheme();

  const stats = useMemo(() => {
    let totalScore = 0;
    let studentCount = 0;
    let riskCount = 0;
    let healthyCount = 0;
    const behaviourDist = { Excellent: 0, Good: 0, Risky: 0, Critical: 0 };

    const filteredStudents =
      selectedDivision === 'All'
        ? students
        : students.filter((s) => s.division === selectedDivision);

    const atRiskStudents = filteredStudents
      .map((student) => {
        const allRecords = Object.values(student.attendance).flat();
        const { score: avgScore, status: finalStatus } = calculateTWAS(allRecords);

        behaviourDist[finalStatus as keyof typeof behaviourDist]++;
        totalScore += avgScore;
        studentCount++;

        if (finalStatus === 'Risky' || finalStatus === 'Critical') {
          riskCount++;
          return { ...student, avgScore, status: finalStatus };
        }
        healthyCount++;
        return null;
      })
      .filter((s) => s !== null) as (Student & {
        avgScore: number;
        status: string;
      })[];

    return {
      avgAttendance: studentCount > 0 ? totalScore / studentCount : 0,
      riskCount,
      healthyCount,
      studentCount,
      behaviourData: Object.entries(behaviourDist).map(([name, value]) => ({
        name,
        value,
      })),
      atRiskStudents: atRiskStudents.sort((a, b) => a.avgScore - b.avgScore).slice(0, 15),
    };
  }, [students, selectedDivision]);

  const COLORS = useMemo(
    () => ({
      Excellent: '#10b981',
      Good: '#3b82f6',
      Risky: '#f97316',
      Critical: '#ef4444',
    }),
    [],
  );

  const chartChrome = useMemo(
    () =>
      theme === 'dark'
        ? {
          grid: '#2a3648',
          tick: '#94a3b8',
          cursor: 'rgba(34, 211, 238, 0.08)',
          tooltipBg: '#141c27',
          tooltipBorder: '#2a3648',
          tooltipShadow: '0 10px 30px -12px rgba(0,0,0,0.45)',
        }
        : {
          grid: '#cbd5e1',
          tick: '#64748b',
          cursor: '#eff6ff',
          tooltipBg: '#f8fafc',
          tooltipBorder: '#cbd5e1',
          tooltipShadow: '0 10px 30px -12px rgba(11,15,25,0.15)',
        },
    [theme],
  );

  return { stats, COLORS, chartChrome };
}
