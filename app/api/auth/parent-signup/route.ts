import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { hashPin } from "@/lib/pin";
import { createParentSessionToken, PARENT_COOKIE_NAME, parentCookieOptions } from "@/lib/parentSession";
import type { ParentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The very first account ever created becomes the admin, permanently, and
// public sign-up closes the instant it exists - every other parent account
// from then on is created BY the admin (see app/api/admin/parents), not by
// self-service sign-up. No dashboard toggle to remember.
export async function POST(req: Request) {
  const { count } = (await queryOne<{ count: string }>("SELECT count(*) FROM parents")) ?? { count: "0" };
  if (Number(count) > 0) {
    return NextResponse.json(
      { error: "Sign-up is closed. Ask the admin to create your account." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  const password: string | undefined = body?.password;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const parent = await queryOne<Pick<ParentRow, "id" | "email" | "role">>(
    "INSERT INTO parents (email, password_hash, role) VALUES ($1, $2, 'admin') RETURNING id, email, role",
    [email, hashPin(password)]
  );
  if (!parent) {
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }

  const token = createParentSessionToken(parent.id);
  const res = NextResponse.json({ parent }, { status: 201 });
  res.cookies.set(PARENT_COOKIE_NAME, token, parentCookieOptions);
  return res;
}

// Lets the sign-up form ask "has an account already been created?" so it can
// show sign-in instead of sign-up without leaking anything else.
export async function GET() {
  const { count } = (await queryOne<{ count: string }>("SELECT count(*) FROM parents")) ?? { count: "0" };
  return NextResponse.json({ signupOpen: Number(count) === 0 });
}
