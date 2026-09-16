import { NextResponse } from "next/server";
import { queryOne, withTransaction } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";

export const dynamic = "force-dynamic";

// POST: wipes a child's rounds, points, redemptions, login history, and
// category priority settings - everything EXCEPT the profile itself (name,
// avatar, level, PIN survive). Useful for resetting a test/demo child back
// to a blank slate without having to recreate their profile and PIN.
// Admin-only, and deliberately irreversible with no soft-undo - the
// confirmation step lives in the UI (components/ChildLog.tsx).
export async function POST(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<{ id: string }>("SELECT id FROM children WHERE id = $1", [childId]);
  if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await withTransaction(async (tx) => {
    // point_transactions.round_id references rounds with no cascade, so it
    // has to go before the rounds it points to.
    await tx.query("DELETE FROM point_transactions WHERE child_id = $1", [childId]);
    // Deleting rounds cascades to round_questions automatically.
    await tx.query("DELETE FROM rounds WHERE child_id = $1", [childId]);
    await tx.query("DELETE FROM redemptions WHERE child_id = $1", [childId]);
    await tx.query("DELETE FROM child_logins WHERE child_id = $1", [childId]);
    await tx.query("DELETE FROM child_category_weights WHERE child_id = $1", [childId]);
  });

  return NextResponse.json({ ok: true });
}
