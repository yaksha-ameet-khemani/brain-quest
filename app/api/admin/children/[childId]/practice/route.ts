import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { queryOne } from "@/lib/db";
import { getPracticeSetsForAdmin } from "@/lib/practice";

export const dynamic = "force-dynamic";

// GET: every practice set, whether it's assigned to this child, their
// progress and their practice answers (lib/practice.ts). PUT/DELETE with
// { setId }: assign or unassign a set. Admin-only.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  return NextResponse.json({ sets: await getPracticeSetsForAdmin(childId) });
}

async function readTarget(req: Request, childId: string) {
  const body = await req.json().catch(() => null);
  const setId: unknown = body?.setId;
  if (typeof setId !== "string") return { error: "setId is required." };
  const found = await queryOne<{ child: string | null; set: string | null }>(
    `SELECT (SELECT id::text FROM children WHERE id::text = $1) AS child,
            (SELECT id::text FROM practice_sets WHERE id::text = $2) AS set`,
    [childId, setId]
  );
  if (!found?.child || !found.set) return { error: "Child or practice set not found." };
  return { setId };
}

export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const target = await readTarget(req, childId);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: 404 });
  await queryOne(
    "INSERT INTO practice_assignments (set_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [target.setId, childId]
  );
  return NextResponse.json({ sets: await getPracticeSetsForAdmin(childId) });
}

// Unassigning only hides the set from the kid - their practice answers stay,
// and assigning it again picks up where they left off.
export async function DELETE(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const target = await readTarget(req, childId);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: 404 });
  await queryOne("DELETE FROM practice_assignments WHERE set_id = $1 AND child_id = $2", [target.setId, childId]);
  return NextResponse.json({ sets: await getPracticeSetsForAdmin(childId) });
}
