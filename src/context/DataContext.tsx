import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { studentService } from '../services/student.service';
import type { Student } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  students: Student[];
  isLoading: boolean;
  fetchStudents: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!isLoggedIn || !profile) return;
    setIsLoading(true);
    
    try {
      const { data: studentsData, error: studentsError } = await studentService.getStudents(profile.role, profile.roll_no);
      if (studentsError) throw studentsError;

      if (studentsData && studentsData.length > 0) {
        const studentIdToFetch = profile.role === 'student' ? studentsData[0].id : undefined;
        const { data: attendanceData, error: attendanceError } = await studentService.getAttendance(profile.role, studentIdToFetch);
        if (attendanceError) throw attendanceError;

        const formattedStudents: Student[] = studentsData.map(s => ({
          id: s.id,
          name: s.name,
          rollNo: s.roll_no,
          division: s.division || 'A',
          batch: s.batch,
          attendance: {}
        })).sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true, sensitivity: 'base' }));

        if (attendanceData) {
          const studentMap = new Map<string, Student>();
          formattedStudents.forEach(s => studentMap.set(s.id, s));

          attendanceData.forEach(record => {
            const student = studentMap.get(record.student_id);
            if (student) {
              if (!student.attendance[record.subject]) {
                student.attendance[record.subject] = [];
              }
              student.attendance[record.subject].push({
                date: record.date,
                lectureNo: record.lecture_no,
                status: record.status as 0 | 1,
                marked_by: record.marked_by
              });
            }
          });
        }
        setStudents(formattedStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, profile]);

  useEffect(() => {
    if (isLoggedIn && profile) {
      fetchStudents();
    }
  }, [isLoggedIn, profile, fetchStudents]);

  return (
    <DataContext.Provider value={{ students, isLoading, fetchStudents }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
