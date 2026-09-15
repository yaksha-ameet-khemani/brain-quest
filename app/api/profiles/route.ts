import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { hashPin } from "@/lib/pin";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: the profile picker screen on the home page needs to know who can play
// - name, avatar, level. Never the pin hash. Unfiltered by owning parent on
// purpose - any kid in the household picks their own tile regardless of
// which parent account manages them; ownership only affects who can
// edit/view a child's data, not who can play.
export async function GET() {
  const children = await query<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    "SELECT id, name, avatar, level FROM children ORDER BY created_at ASC"
  );
  return NextResponse.json({ children });
}

// POST: create a new kid profile.
// - A regular parent's children are automatically owned by them.
// - Admin must specify which parent (parentId in the body) the child
//   belongs to - including, if they want, the admin's own account. Admin
//   creating a child always requires selecting/creating that parent first,
//   by design.
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

  let ownerParentId: string;
  if (parent.role === "admin") {
    const requestedParentId: string | undefined = body?.parentId;
    if (!requestedParentId) {
      return NextResponse.json(
        { error: "parentId is required - pick which parent this child belongs to." },
        { status: 400 }
      );
    }
    const owner = await queryOne("SELECT id FROM parents WHERE id = $1", [requestedParentId]);
    if (!owner) {
      return NextResponse.json({ error: "That parent account doesn't exist." }, { status: 400 });
    }
    ownerParentId = requestedParentId;
  } else {
    ownerParentId = parent.id;
  }

  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    `INSERT INTO children (parent_id, name, level, avatar, pin_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, avatar, level`,
    [ownerParentId, name, level, avatar, hashPin(pin)]
  );
  if (!child) {
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }
  return NextResponse.json({ child }, { status: 201 });
}
