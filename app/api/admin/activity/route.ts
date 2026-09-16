import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { getChildActivitySummary } from "@/lib/childActivitySummary";

export const dynamic = "force-dynamic";

// Admin-only. This used to be a public, no-login endpoint at the family's
// own request; reversed at their later request once it read too much like a
// sibling leaderboard sitting on the homepage. See docs/blueprint.md.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const activity = await getChildActivitySummary();
  return NextResponse.json({ activity });
}
