import { BATCH_MAP, DIVISIONS } from '../../../src/constants';

export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;
  
  try {
    const results: any = { students: 0, timetable: 0 };

    // 1. Fix Students
    // We want to find students where the batch is NOT in the valid list for their division
    const { results: students } = await DB.prepare("SELECT id, division, batch FROM students WHERE batch IS NOT NULL").all();
    
    const studentFixes = [];
    for (const student of students as any) {
      const validBatches = BATCH_MAP[student.division as any] || [];
      if (!validBatches.includes(student.batch)) {
        // If batch is invalid, we could either clear it or try to guess.
        // For now, let's just clear it so the admin can re-assign correctly, 
        // OR if there's only one batch we could assign it.
        // Actually, the safest is to clear it or log it.
        // User said: "c division has F6 in it". 
        // Let's clear invalid batches.
        studentFixes.push(DB.prepare("UPDATE students SET batch = NULL WHERE id = ?").bind(student.id));
      }
    }
    if (studentFixes.length > 0) {
      await DB.batch(studentFixes);
      results.students = studentFixes.length;
    }

    // 2. Fix Timetable
    const { results: timetable } = await DB.prepare("SELECT id, division, batch FROM timetable WHERE batch IS NOT NULL").all();
    const timetableFixes = [];
    for (const entry of timetable as any) {
      const validBatches = BATCH_MAP[entry.division as any] || [];
      if (!validBatches.includes(entry.batch)) {
        timetableFixes.push(DB.prepare("UPDATE timetable SET batch = NULL WHERE id = ?").bind(entry.id));
      }
    }
    if (timetableFixes.length > 0) {
      await DB.batch(timetableFixes);
      results.timetable = timetableFixes.length;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Batch cleanup completed.", 
      results 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
