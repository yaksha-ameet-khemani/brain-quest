import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { getNegativeMarkingEnabled, setNegativeMarkingEnabled } from "@/lib/gameSettings";

export const dynamic = "force-dynamic";

// GET/PUT: family-wide game settings - currently just the wrong-answer
// negative-marking toggle. Admin-only; see components/ParentDashboard.tsx.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const negativeMarking = await getNegativeMarkingEnabled();
  return NextResponse.json({ negativeMarking });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.negativeMarking !== "boolean") {
    return NextResponse.json({ error: "negativeMarking must be a boolean." }, { status: 400 });
  }

  const negativeMarking = await setNegativeMarkingEnabled(body.negativeMarking);
  return NextResponse.json({ negativeMarking });
}
