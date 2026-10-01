import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import {
  getNegativeMarkingEnabled,
  getPenPaperSeconds,
  setNegativeMarkingEnabled,
  setPenPaperSeconds,
} from "@/lib/gameSettings";
import { PEN_PAPER_MAX_SECONDS, PEN_PAPER_MIN_SECONDS } from "@/lib/config";

export const dynamic = "force-dynamic";

// GET/PUT: family-wide game settings - the wrong-answer negative-marking
// toggle and the pen & paper timer. PUT takes either or both. Admin-only;
// see components/ParentDashboard.tsx.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const [negativeMarking, penPaperSeconds] = await Promise.all([getNegativeMarkingEnabled(), getPenPaperSeconds()]);
  return NextResponse.json({ negativeMarking, penPaperSeconds });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const hasNegative = body?.negativeMarking !== undefined;
  const hasPenPaper = body?.penPaperSeconds !== undefined;
  if (!hasNegative && !hasPenPaper) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  if (hasNegative && typeof body.negativeMarking !== "boolean") {
    return NextResponse.json({ error: "negativeMarking must be a boolean." }, { status: 400 });
  }
  if (
    hasPenPaper &&
    (!Number.isInteger(body.penPaperSeconds) ||
      body.penPaperSeconds < PEN_PAPER_MIN_SECONDS ||
      body.penPaperSeconds > PEN_PAPER_MAX_SECONDS)
  ) {
    return NextResponse.json(
      { error: `penPaperSeconds must be a whole number from ${PEN_PAPER_MIN_SECONDS} to ${PEN_PAPER_MAX_SECONDS}.` },
      { status: 400 }
    );
  }

  if (hasNegative) await setNegativeMarkingEnabled(body.negativeMarking);
  if (hasPenPaper) await setPenPaperSeconds(body.penPaperSeconds);
  const [negativeMarking, penPaperSeconds] = await Promise.all([getNegativeMarkingEnabled(), getPenPaperSeconds()]);
  return NextResponse.json({ negativeMarking, penPaperSeconds });
}
