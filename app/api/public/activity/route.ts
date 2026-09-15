import { NextResponse } from "next/server";
import { getPublicActivity } from "@/lib/publicActivity";

export const dynamic = "force-dynamic";

// Deliberately public, no auth - see docs/blueprint.md for the reasoning.
// Aggregate-only (no per-question detail, no answer content) - the detailed
// per-question log lives behind /api/parent/children/[childId]/log instead,
// which does require a parent/admin session.
export async function GET() {
  const activity = await getPublicActivity();
  return NextResponse.json({ activity });
}
