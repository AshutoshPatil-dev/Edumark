export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  const { DB } = context.env;
  const { method } = context.request;

  if (method === "GET") {
    try {
      const { results } = await DB.prepare(
        "SELECT l.*, p.full_name as actor_name FROM admin_logs l LEFT JOIN profiles p ON l.actor_id = p.id ORDER BY l.created_at DESC LIMIT 100"
      ).all();

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
        INSERT INTO admin_logs (actor_id, category, action, details)
        VALUES (?, ?, ?, ?)
      `).bind(data.actor_id, data.category, data.action, data.details).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
