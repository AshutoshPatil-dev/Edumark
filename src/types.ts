/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AttendanceRecord {
  date: string;
  lectureNo: number;
  status: 1 | 0; // 1 for Present, 0 for Absent
  marked_by?: string;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  division: string;
  batch?: string;
  attendance: {
    [subjectId: string]: AttendanceRecord[];
  };
}

export interface Profile {
  id: string;
  role: 'faculty' | 'student' | 'admin';
  full_name: string | null;
  assigned_subjects: string[];
  roll_no: string | null;
}

export type BehaviourStatus = 'Excellent' | 'Good' | 'Risky' | 'Critical';

export interface TWASResult {
  score: number;
  status: BehaviourStatus;
}

export interface TimetableEntry {
  id: string;
  day_of_week: number;
  subject_id: string;
  division: string;
  faculty_id: string;
  lecture_no: number;
  batch?: string;
  slot_time?: string;
}

export interface AttendanceLog {
  id: string;
  date: string;
  subject_id: string;
  division: string;
  batch?: string;
  faculty_id: string;
  action: string;
  notes?: string;
  created_at: string;
  slot_time?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}
