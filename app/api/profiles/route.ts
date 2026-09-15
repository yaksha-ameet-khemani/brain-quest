import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { hashPin } from "@/lib/pin";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: the profile picker screen on the home page needs to know who can play
// - name, avatar, level. Never the pin hash. This is a single-household
// deployment (see docs/SETUP.md), so every child in the table is shown; it
// is not a multi-family public listing.
export async function GET() {
  const children = await query<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    "SELECT id, name, avatar, level FROM children ORDER BY created_at ASC"
  );
  return NextResponse.json({ children });
}

// POST: create a new kid profile. Any signed-in parent or admin - all
// parents share the same pool of children, there's no per-parent ownership.
export async function POST(req: Request) {
  const parent = await requireParent();
  if (!parent) {
    return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const level: number | undefined = body?.level;
  const pin: string | undefined = body?.pin;
  const avatar: string = body?.avatar?.trim() || "🙂";

  if (!name || (level !== 1 && level !== 2) || !pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "name, level (1 or 2), and a 4-6 digit pin are required." },
      { status: 400 }
    );
  }

  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    `INSERT INTO children (created_by, name, level, avatar, pin_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, avatar, level`,
    [parent.id, name, level, avatar, hashPin(pin)]
  );
  if (!child) {
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }
  return NextResponse.json({ child }, { status: 201 });
}
