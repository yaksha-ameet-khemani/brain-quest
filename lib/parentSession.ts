import { createHmac, timingSafeEqual } from "crypto";

// Same signed-cookie approach as lib/kidSession.ts, for the same reason: no
// external auth service now that we've moved off Supabase, so we sign our
// own session token. Separate secret and cookie name from the kid session so
// the two can never be confused with each other.

export const PARENT_COOKIE_NAME = "parent_session";
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days - parents don't want to re-login constantly

interface ParentSessionPayload {
  parentId: string;
  issuedAt: number;
}

function secret(): string {
  const s = process.env.PARENT_SESSION_SECRET;
  if (!s) throw new Error("PARENT_SESSION_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createParentSessionToken(parentId: string): string {
  const payload: ParentSessionPayload = { parentId, issuedAt: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyParentSessionToken(token: string | undefined | null): { parentId: string } | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: ParentSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (Date.now() - payload.issuedAt > SESSION_LIFETIME_MS) return null;
  return { parentId: payload.parentId };
}

export const parentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_LIFETIME_MS / 1000,
};
