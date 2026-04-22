export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;
  const { method } = context.request;
  const url = new URL(context.request.url);

  if (method === "GET") {
    const dayOfWeek = url.searchParams.get('dayOfWeek');
    const subjectId = url.searchParams.get('subjectId');
    const facultyId = url.searchParams.get('facultyId');
    const division = url.searchParams.get('division');

    try {
      let query = "SELECT * FROM timetable WHERE 1=1";
      const params: any[] = [];

      if (dayOfWeek) {
        query += " AND day_of_week = ?";
        params.push(parseInt(dayOfWeek));
      }
      if (subjectId) {
        query += " AND subject_id = ?";
        params.push(subjectId);
      }
      if (facultyId) {
        query += " AND faculty_id = ?";
        params.push(facultyId);
      }
      if (division) {
        query += " AND division = ?";
        params.push(division);
      }

      const { results } = await DB.prepare(query).bind(...params).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  if (method === "POST") {
    try {
      const data = await context.request.json() as any;
      
      if (Array.isArray(data)) {
        const statements = data.map(t => 
          DB.prepare(`
            INSERT INTO timetable (day_of_week, subject_id, division, batch, lecture_no, faculty_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(t.day_of_week, t.subject_id, t.division, t.batch, t.lecture_no, t.faculty_id)
        );
        await DB.batch(statements);
      } else {
        await DB.prepare(`
          INSERT INTO timetable (day_of_week, subject_id, division, batch, lecture_no, faculty_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(data.day_of_week, data.subject_id, data.division, data.batch, data.lecture_no, data.faculty_id).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  if (method === "PUT") {
    try {
      const data = await context.request.json() as any;
      const id = url.searchParams.get('id');

      await DB.prepare(`
        UPDATE timetable SET
        day_of_week = ?, subject_id = ?, division = ?, batch = ?, lecture_no = ?, faculty_id = ?
        WHERE id = ?
      `).bind(data.day_of_week, data.subject_id, data.division, data.batch, data.lecture_no, data.faculty_id, id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  if (method === "DELETE") {
    try {
      const id = url.searchParams.get('id');
      await DB.prepare("DELETE FROM timetable WHERE id = ?").bind(id).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
