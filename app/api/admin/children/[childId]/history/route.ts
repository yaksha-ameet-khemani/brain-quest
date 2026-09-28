import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { getPointsHistory } from "@/lib/pointsHistory";

export const dynamic = "force-dynamic";

// Any child's 30-day points/logins/rewards history - admin only.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  return NextResponse.json(await getPointsHistory(childId));
}
