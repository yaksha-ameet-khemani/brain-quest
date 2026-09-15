import { createHmac, timingSafeEqual } from "crypto";

// Kids don't get email/password accounts - they pick their profile and type a
// PIN their parent set. This signs a tiny, tamper-proof session token for
// that, good enough for a family app and with zero external dependency or
// cost. It is NOT a substitute for real auth on anything sensitive - parent
// actions always go through Supabase Auth instead (see lib/supabaseServerAuth.ts).

export const KID_COOKIE_NAME = "kid_session";
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours

interface KidSessionPayload {
  childId: string;
  issuedAt: number;
}

function secret(): string {
  const s = process.env.KID_SESSION_SECRET;
  if (!s) throw new Error("KID_SESSION_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createKidSessionToken(childId: string): string {
  const payload: KidSessionPayload = { childId, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyKidSessionToken(token: string | undefined | null): { childId: string } | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: KidSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (Date.now() - payload.issuedAt > SESSION_LIFETIME_MS) return null;
  return { childId: payload.childId };
}

export const kidCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_LIFETIME_MS / 1000,
};
