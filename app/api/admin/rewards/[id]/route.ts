import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import type { RewardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH: edit a reward's content, or toggle isActive (archive/restore).
// Admin-only. There's no hard DELETE - a reward that's ever been redeemed
// is referenced by `redemptions` (a child's permanent redemption history,
// which also snapshots the name/cost it had at request time regardless),
// so "remove from the catalog" is what active = false means, not erase -
// same convention as the question bank's is_active.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof body?.name === "string" && body.name.trim()) {
    sets.push(`name = $${i++}`);
    values.push(body.name.trim());
  }
  if (body?.cost !== undefined) {
    const cost = Number(body.cost);
    if (!Number.isInteger(cost) || cost <= 0) {
      return NextResponse.json({ error: "cost must be a positive integer." }, { status: 400 });
    }
    sets.push(`cost = $${i++}`);
    values.push(cost);
  }
  if (typeof body?.emoji === "string" && body.emoji.trim()) {
    sets.push(`emoji = $${i++}`);
    values.push(body.emoji.trim());
  }
  if (typeof body?.isActive === "boolean") {
    sets.push(`active = $${i++}`);
    values.push(body.isActive);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(id);
  const reward = await queryOne<RewardRow>(`UPDATE rewards SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, values);
  if (!reward) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ reward });
}
