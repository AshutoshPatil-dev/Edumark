export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;

  try {
    // 1. Fetch all students
    const { results: students } = await DB.prepare("SELECT * FROM students").all();

    // 2. Fetch all attendance records
    const { results: attendance } = await DB.prepare("SELECT * FROM attendance").all();

    // 3. Combine them into the format the app expects
    const formattedStudents = students.map((s: any) => {
      const studentAttendance: any = {};
      
      // Filter attendance for this student
      attendance.filter((a: any) => a.student_id === s.id).forEach((record: any) => {
        if (!studentAttendance[record.subject]) {
          studentAttendance[record.subject] = [];
        }
        studentAttendance[record.subject].push({
          date: record.date,
          lectureNo: record.lecture_no,
          status: record.status,
          marked_by: record.marked_by
        });
      });

      return {
        id: s.id,
        name: s.name,
        rollNo: s.roll_no,
        division: s.division || 'A',
        batch: s.batch,
        attendance: studentAttendance
      };
    });

    return new Response(JSON.stringify(formattedStudents), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
