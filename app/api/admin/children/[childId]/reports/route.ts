import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { queryOne } from "@/lib/db";
import { localDateKey } from "@/lib/timezone";
import { ensureSavedReports, periodStartFor } from "@/lib/periodReport";

export const dynamic = "force-dynamic";

// Lists a child's saved 10-day reports (saving any finished period that's
// missing one first) plus the period currently in progress. Admin-only.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<{ id: string }>("SELECT id FROM children WHERE id = $1", [childId]);
  if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const saved = await ensureSavedReports(childId);
  return NextResponse.json({ saved, currentPeriodStart: periodStartFor(localDateKey()) });
}
