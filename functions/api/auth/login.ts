import { SignJWT } from 'jose';

const encoder = new TextEncoder();

async function verifyPassword(password: string, storedHash: string) {
  const [saltHex, hashHex] = storedHash.split(':');
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const passwordBuffer = encoder.encode(password);
  const baseKey = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    256
  );
  const currentHashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return currentHashHex === hashHex;
}

export const onRequest: PagesFunction<{ DB: D1Database; JWT_SECRET: string }> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email, password } = await context.request.json() as any;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400 });
    }

    const { DB, JWT_SECRET } = context.env;

    // 1. Fetch user
    const user = await DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<any>();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), { status: 401 });
    }

    // 2. Fetch profile
    const profile = await DB.prepare("SELECT * FROM profiles WHERE id = ?").bind(user.id).first<any>();

    // 3. Create JWT
    const token = await new SignJWT({ userId: user.id, role: profile.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(JWT_SECRET || 'fallback_secret'));

    return new Response(JSON.stringify({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        fullName: profile.full_name, 
        role: profile.role 
      } 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
