import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { queryOne } from "@/lib/db";
import { localDateKey } from "@/lib/timezone";
import { buildPeriodReport, getSavedReport, periodStartFor } from "@/lib/periodReport";

export const dynamic = "force-dynamic";

// One full 10-day report. A finished period comes from its frozen saved copy;
// the period in progress is built live (and never saved). Admin-only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ childId: string; periodStart: string }> }
) {
  const { childId, periodStart } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<{ id: string }>("SELECT id FROM children WHERE id = $1", [childId]);
  if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (periodStart === periodStartFor(localDateKey())) {
    return NextResponse.json({ report: await buildPeriodReport(childId, periodStart) });
  }

  const report = /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? await getSavedReport(childId, periodStart) : null;
  if (!report) return NextResponse.json({ error: "No saved report for that period." }, { status: 404 });
  return NextResponse.json({ report });
}
