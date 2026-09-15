import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { hashPin } from "@/lib/pin";
import type { ParentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET: list every parent account. Admin-only.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const parents = await query<Pick<ParentRow, "id" | "email" | "role" | "created_at">>(
    "SELECT id, email, role, created_at FROM parents ORDER BY created_at ASC"
  );
  return NextResponse.json({ parents });
}

// POST: create a new parent account. Admin-only - this is the only way to
// add a parent once the admin account exists, since public sign-up closes
// forever the moment it does (see app/api/auth/parent-signup).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  const password: string | undefined = body?.password;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await queryOne("SELECT id FROM parents WHERE email = $1", [email]);
  if (existing) {
    return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  const parent = await queryOne<Pick<ParentRow, "id" | "email" | "role">>(
    "INSERT INTO parents (email, password_hash, role) VALUES ($1, $2, 'parent') RETURNING id, email, role",
    [email, hashPin(password)]
  );
  if (!parent) return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  return NextResponse.json({ parent }, { status: 201 });
}
