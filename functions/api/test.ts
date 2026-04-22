export const onRequest: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const { DB } = context.env;
    
    // Simple query to test the connection
    const result = await DB.prepare("SELECT 1").first();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "D1 connection successful!",
      result 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
