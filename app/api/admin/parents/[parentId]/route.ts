import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import type { ParentRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// DELETE: remove a parent account. Admin-only, and the admin account itself
// can never be deleted through this route - guarded here in code, and the
// database's parents_single_admin_idx would refuse a second admin to exist
// anyway, but this check exists so deleting the *only* admin can never
// happen at all, by anyone, under any circumstance.
//
// A parent who still owns children is refused too (children.parent_id is
// NOT NULL, so the database itself would reject this - checked here first
// for a clear message instead of a raw constraint-violation error).
export async function DELETE(_req: Request, { params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const target = await queryOne<Pick<ParentRow, "id" | "role">>("SELECT id, role FROM parents WHERE id = $1", [
    parentId,
  ]);
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "The admin account cannot be deleted." }, { status: 403 });
  }

  const countRow = await queryOne<{ count: string }>("SELECT count(*) FROM children WHERE parent_id = $1", [
    parentId,
  ]);
  const count = countRow?.count ?? "0";
  if (Number(count) > 0) {
    return NextResponse.json(
      {
        error: `This parent still has ${count} child ${
          Number(count) === 1 ? "profile" : "profiles"
        }. Reassign or delete them first (as admin, edit each child).`,
      },
      { status: 409 }
    );
  }

  await queryOne("DELETE FROM parents WHERE id = $1", [parentId]);
  return NextResponse.json({ ok: true });
}
