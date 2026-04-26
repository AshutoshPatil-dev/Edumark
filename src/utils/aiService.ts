/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SUBJECTS, DIVISIONS, type SubjectId, type DivisionId } from '../constants';

export interface ParsedAttendance {
  subject?: SubjectId;
  division?: DivisionId;
  rollNumbers: number[];
  status: 'present' | 'absent';
  isException?: boolean; // If true, means "Everyone [status] EXCEPT [rollNumbers]"
  remark?: string; // Optional note for the attendance records
}

/**
 * Service to parse natural language attendance messages.
 * Uses Gemini API (if key available) or a robust regex fallback.
 */
export async function parseAttendanceMessage(message: string): Promise<ParsedAttendance> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    try {
      return await parseWithGemini(message, apiKey);
    } catch (error) {
      console.error('Gemini parsing failed, falling back to regex:', error);
    }
  }

  return parseWithRegex(message);
}

async function parseWithGemini(message: string, apiKey: string): Promise<ParsedAttendance> {
  const prompt = `
    Extract school attendance information from this message: "${message}"
    
    Context:
    - Subjects: ${SUBJECTS.join(', ')}
    - Divisions: ${DIVISIONS.join(', ')}
    
    Return a JSON object with:
    - "subject": (string, must match one of the subjects above, or null)
    - "division": (string, must match one of the divisions above, or null)
    - "rollNumbers": (array of numbers, expand ranges like "1-5" to [1,2,3,4,5])
    - "status": (string, either "present" or "absent")
    - "isException": (boolean, set to true if the message implies "everyone is X except Y")
    - "remark": (string, extract any note or reason mentioned, like "bunking", "medical", etc., or null)
    
    Example input: "DEIC division C roll 1-3 were absent with note bunk"
    Example output: {"subject": "DEIC", "division": "C", "rollNumbers": [1, 2, 3], "status": "absent", "isException": false, "remark": "bunk"}
    
    Only return the JSON.
  `;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  });

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

/**
 * Fallback regex-based parser for basic commands
 */
function parseWithRegex(message: string): ParsedAttendance {
  const msg = message.toLowerCase();
  
  // 1. Extract Subject
  let subject: SubjectId | undefined;
  for (const s of SUBJECTS) {
    if (msg.includes(s.toLowerCase())) {
      subject = s;
      break;
    }
  }

  // 2. Extract Division
  let division: DivisionId | undefined;
  const divMatch = msg.match(/division\s+([a-g])/i) || msg.match(/div\s+([a-g])/i);
  if (divMatch) {
    division = divMatch[1].toUpperCase() as DivisionId;
  }

  // 3. Extract Status
  const status: 'present' | 'absent' = msg.includes('present') ? 'present' : 'absent';
  
  // Detect exception
  const isException = msg.includes('except') || msg.includes('but') || msg.includes('everyone');

  // 4. Extract Remark
  let remark: string | undefined;
  const remarkMatch = msg.match(/(?:note|remark|reason|because|with)\s+(.+)$/i);
  if (remarkMatch) {
    remark = remarkMatch[1].trim();
  }

  // 5. Extract Roll Numbers
  const rollNumbers: number[] = [];
  
  // Look for ranges like "1-10"
  const rangeMatches = msg.matchAll(/(\d+)\s*-\s*(\d+)/g);
  for (const match of rangeMatches) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      for (let i = start; i <= end; i++) rollNumbers.push(i);
    }
  }

  // Look for individual numbers (avoiding those already in ranges)
  const numMatches = msg.matchAll(/\b(\d+)\b/g);
  for (const match of numMatches) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && !rollNumbers.includes(num)) {
      // Basic heuristic: skip if it looks like a year or date
      if (num > 0 && num < 200) {
        rollNumbers.push(num);
      }
    }
  }

  return {
    subject,
    division,
    rollNumbers: Array.from(new Set(rollNumbers)).sort((a, b) => a - b),
    status,
    isException,
    remark
  };
}
