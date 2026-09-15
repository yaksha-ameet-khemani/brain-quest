import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { hashPin } from "@/lib/pin";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

async function ownedChildOrNull(childId: string, parentId: string) {
  const child = await queryOne<Pick<ChildRow, "id" | "parent_id">>(
    "SELECT id, parent_id FROM children WHERE id = $1",
    [childId]
  );
  if (!child || child.parent_id !== parentId) return null;
  return child;
}

// PATCH: edit a child's name/avatar/level, or reset their PIN. Parent-only,
// and only for a child that parent created.
export async function PATCH(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const owned = await ownedChildOrNull(childId, parent.id);
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof body?.name === "string" && body.name.trim()) {
    sets.push(`name = $${i++}`);
    values.push(body.name.trim());
  }
  if (typeof body?.avatar === "string" && body.avatar.trim()) {
    sets.push(`avatar = $${i++}`);
    values.push(body.avatar.trim());
  }
  if (body?.level === 1 || body?.level === 2) {
    sets.push(`level = $${i++}`);
    values.push(body.level);
  }
  if (typeof body?.pin === "string") {
    if (!/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN must be 4-6 digits." }, { status: 400 });
    }
    sets.push(`pin_hash = $${i++}`);
    values.push(hashPin(body.pin));
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(childId);
  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    `UPDATE children SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, name, avatar, level`,
    values
  );
  if (!child) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ child });
}

// DELETE: remove a child profile entirely (cascades to their rounds/points/
// redemptions per the schema's ON DELETE CASCADE). Parent-only.
export async function DELETE(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const owned = await ownedChildOrNull(childId, parent.id);
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await queryOne("DELETE FROM children WHERE id = $1", [childId]);
  return NextResponse.json({ ok: true });
}
