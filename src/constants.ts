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
