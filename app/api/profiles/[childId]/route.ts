import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";
import { hashPin } from "@/lib/pin";
import type { Database } from "@/lib/database.types";

type ChildUpdate = Database["public"]["Tables"]["children"]["Update"];

export const dynamic = "force-dynamic";

async function ownedChildOrNull(childId: string, parentId: string) {
  const { data } = await supabaseAdmin()
    .from("children")
    .select("id, parent_id")
    .eq("id", childId)
    .single();
  if (!data || data.parent_id !== parentId) return null;
  return data;
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
  const update: ChildUpdate = {};
  if (typeof body?.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body?.avatar === "string" && body.avatar.trim()) update.avatar = body.avatar.trim();
  if (body?.level === 1 || body?.level === 2) update.level = body.level;
  if (typeof body?.pin === "string") {
    if (!/^\d{4,6}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN must be 4-6 digits." }, { status: 400 });
    }
    update.pin_hash = hashPin(body.pin);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("children")
    .update(update)
    .eq("id", childId)
    .select("id, name, avatar, level")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ child: data });
}

// DELETE: remove a child profile entirely (cascades to their rounds/points/
// redemptions per the schema's ON DELETE CASCADE). Parent-only.
export async function DELETE(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const owned = await ownedChildOrNull(childId, parent.id);
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { error } = await supabaseAdmin().from("children").delete().eq("id", childId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
