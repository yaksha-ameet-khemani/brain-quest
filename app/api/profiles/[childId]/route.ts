import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { hashPin } from "@/lib/pin";
import { MAX_PHOTO_DATA_URL_LENGTH } from "@/lib/config";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

async function ownedChildOrForbidden(childId: string, parent: { id: string; role: "admin" | "parent" }) {
  const child = await queryOne<Pick<ChildRow, "id" | "parent_id">>(
    "SELECT id, parent_id FROM children WHERE id = $1",
    [childId]
  );
  if (!child) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  if (parent.role !== "admin" && child.parent_id !== parent.id) {
    return { error: NextResponse.json({ error: "That's not your child to manage." }, { status: 403 }) };
  }
  return { child };
}

// PATCH: edit a child's name/avatar/level, or reset their PIN. Admin can
// manage any child; a parent only their own.
export async function PATCH(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const owned = await ownedChildOrForbidden(childId, parent);
  if ("error" in owned) return owned.error;

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
  if ("photoDataUrl" in (body ?? {})) {
    if (body.photoDataUrl === null) {
      // Explicit null clears the photo, falling back to the emoji avatar.
      sets.push(`photo_data_url = $${i++}`);
      values.push(null);
    } else if (typeof body.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:image/")) {
      if (body.photoDataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        return NextResponse.json({ error: "That photo is too large." }, { status: 400 });
      }
      sets.push(`photo_data_url = $${i++}`);
      values.push(body.photoDataUrl);
    } else {
      return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
    }
  }
  if (typeof body?.parentId === "string") {
    if (parent.role !== "admin") {
      return NextResponse.json({ error: "Only admin can reassign a child to a different parent." }, { status: 403 });
    }
    const newOwner = await queryOne("SELECT id FROM parents WHERE id = $1", [body.parentId]);
    if (!newOwner) return NextResponse.json({ error: "That parent account doesn't exist." }, { status: 400 });
    sets.push(`parent_id = $${i++}`);
    values.push(body.parentId);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(childId);
  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "photo_data_url" | "level">>(
    `UPDATE children SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, name, avatar, photo_data_url, level`,
    values
  );
  if (!child) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({
    child: {
      id: child.id,
      name: child.name,
      avatar: child.avatar,
      photoDataUrl: child.photo_data_url,
      level: child.level,
    },
  });
}

// DELETE: remove a child profile entirely (cascades to their rounds/points/
// redemptions/logins per the schema's ON DELETE CASCADE). Admin can remove
// any child; a parent only their own.
export async function DELETE(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const owned = await ownedChildOrForbidden(childId, parent);
  if ("error" in owned) return owned.error;

  await queryOne("DELETE FROM children WHERE id = $1", [childId]);
  return NextResponse.json({ ok: true });
}
