/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { AttendanceRecord, TWASResult, BehaviourStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateTWAS(records: AttendanceRecord[]): TWASResult {
  if (!records || records.length === 0) {
    return { score: 100, status: 'Excellent' };
  }

  // Sort records by date and lecture number (ascending)
  const sortedRecords = [...records].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.lectureNo - b.lectureNo;
  });

  let totalWeight = 0;
  let weightedSum = 0;

  sortedRecords.forEach((record, index) => {
    const weight = index + 1; // More recent records have higher index and thus higher weight
    totalWeight += weight;
    weightedSum += record.status * weight;
  });

  const score = (weightedSum / totalWeight) * 100;

  let status: BehaviourStatus = 'Excellent';
  if (score >= 85) status = 'Excellent';
  else if (score >= 70) status = 'Good';
  else if (score >= 50) status = 'Risky';
  else status = 'Critical';

  return { score, status };
}

export function getStatusColor(status: BehaviourStatus): string {
  switch (status) {
    case 'Excellent':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'Good':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'Risky':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'Critical':
      return 'text-rose-600 bg-rose-50 border-rose-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}
