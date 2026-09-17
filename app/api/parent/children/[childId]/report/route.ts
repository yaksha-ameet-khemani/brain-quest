import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { ownedChild } from "@/lib/childOwnership";
import { getChildReport } from "@/lib/childReport";
import type { ChildRow } from "@/lib/types";
import type { Level } from "@/lib/config";

export const dynamic = "force-dynamic";

// GET: one child's parent-facing report (strengths, weaknesses, trend,
// specific things to work on). Parent/admin only, same ownership rule as
// the raw log route this sits alongside.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  if (!(await ownedChild(childId, parent))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const childRow = await queryOne<Pick<ChildRow, "level">>("SELECT level FROM children WHERE id = $1", [childId]);
  if (!childRow) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const report = await getChildReport(childId, childRow.level as Level);
  return NextResponse.json({ report });
}
