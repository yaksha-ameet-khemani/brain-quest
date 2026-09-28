import { NextResponse } from "next/server";
import { requireKid } from "@/lib/requireKid";
import { getPointsHistory } from "@/lib/pointsHistory";

export const dynamic = "force-dynamic";

// The signed-in kid's OWN 30-day history. The child id comes only from the
// kid session cookie, never from the request, so a kid can't view a sibling's.
export async function GET() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  return NextResponse.json(await getPointsHistory(kid.childId));
}
