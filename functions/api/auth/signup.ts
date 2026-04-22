import { SignJWT } from 'jose';

const encoder = new TextEncoder();

export const onRequest: PagesFunction<{ DB: D1Database; JWT_SECRET: string }> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { email, password, fullName, role } = await context.request.json() as any;

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const { DB, JWT_SECRET } = context.env;

    // 1. Hash password using Web Crypto (PBKDF2)
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const passwordBuffer = encoder.encode(password);
    const baseKey = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      256
    );
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    const passwordHash = `${saltHex}:${hashHex}`;

    // 2. Create User
    const userId = crypto.randomUUID();
    await DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
      .bind(userId, email, passwordHash)
      .run();

    // 3. Create Profile
    await DB.prepare("INSERT INTO profiles (id, full_name, role) VALUES (?, ?, ?)")
      .bind(userId, fullName, role)
      .run();

    // 4. Create JWT
    const token = await new SignJWT({ userId, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(JWT_SECRET || 'fallback_secret'));

    return new Response(JSON.stringify({ success: true, token, user: { id: userId, email, fullName, role } }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
