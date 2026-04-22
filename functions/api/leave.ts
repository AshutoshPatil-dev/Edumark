export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;
  const { method } = context.request;

  if (method === "GET") {
    const url = new URL(context.request.url);
    const studentId = url.searchParams.get('studentId');

    try {
      let query = "SELECT * FROM leave_requests";
      const params: any[] = [];

      if (studentId) {
        query += " WHERE student_id = ?";
        params.push(studentId);
      }
      query += " ORDER BY created_at DESC";

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
      
      await DB.prepare(`
        INSERT INTO leave_requests (student_id, start_date, end_date, reason, status)
        VALUES (?, ?, ?, ?, ?)
      `).bind(data.student_id, data.start_date, data.end_date, data.reason, data.status || 'pending').run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
