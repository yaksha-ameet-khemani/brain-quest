import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { createParentSessionToken, PARENT_COOKIE_NAME, parentCookieOptions } from "@/lib/parentSession";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ParentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  const password: string | undefined = body?.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // 10 attempts per email per 15 minutes - a real parent mistyping a
  // password a few times is fine, brute-forcing it is not.
  if (!checkRateLimit(`parent-login:${email}`, 10, 15 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  const parent = await queryOne<ParentRow>("SELECT * FROM parents WHERE email = $1", [email]);
  if (!parent || !verifyPin(password, parent.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = createParentSessionToken(parent.id);
  const res = NextResponse.json({ parent: { id: parent.id, email: parent.email } });
  res.cookies.set(PARENT_COOKIE_NAME, token, parentCookieOptions);
  return res;
}
