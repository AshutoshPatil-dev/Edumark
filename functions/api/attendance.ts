export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;
  const { method } = context.request;

  if (method === "GET") {
    const url = new URL(context.request.url);
    const date = url.searchParams.get('date');
    const subject = url.searchParams.get('subject');
    const lectureNo = url.searchParams.get('lectureNo');

    try {
      const { results } = await DB.prepare(
        "SELECT * FROM attendance WHERE date = ? AND subject = ? AND lecture_no = ?"
      ).bind(date, subject, lectureNo).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  if (method === "POST") {
    try {
      const records = await context.request.json() as any[];

      // Use a transaction for multiple records
      const statements = records.map(r => 
        DB.prepare(`
          INSERT INTO attendance (student_id, subject, date, lecture_no, status, marked_by)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(student_id, subject, date, lecture_no) DO UPDATE SET
          status = excluded.status,
          marked_by = excluded.marked_by
        `).bind(r.student_id, r.subject, r.date, r.lecture_no, r.status, r.marked_by)
      );

      await DB.batch(statements);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
