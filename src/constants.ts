/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const SUBJECTS = [
  'DEIC',
  'AC',
  'DLDM',
  'CTP',
  'DM',
  'CTPL',
  'PBL',
  'DLDML',
  'PC',
  'IKS',
  'DEIC-T',
] as const;

export type SubjectId = (typeof SUBJECTS)[number];

export const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type DivisionId = (typeof DIVISIONS)[number];

export const BATCH_MAP: Record<DivisionId, string[]> = {
  'A': ['F1', 'F2', 'F3'],
  'B': ['F4', 'F5', 'F6'],
  'C': ['F7', 'F8', 'F9'],
  'D': ['F10', 'F11', 'F12'],
  'E': ['F13', 'F14', 'F15'],
  'F': ['F16', 'F17', 'F18'],
  'G': ['F19', 'F20', 'F21'],
};

export function getBatchesForDivision(division: DivisionId): string[] {
  return BATCH_MAP[division] || [];
}
