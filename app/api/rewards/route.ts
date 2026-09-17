import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { RewardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: the reward catalog. Names/costs/emoji are not sensitive, so this is
// readable without a session (kids see it right after logging in, but there's
// no harm in the catalog itself being visible). Managing the catalog
// (add/edit/archive) is admin-only - see app/api/admin/rewards.
export async function GET() {
  const rewards = await query<Pick<RewardRow, "id" | "name" | "cost" | "emoji">>(
    "SELECT id, name, cost, emoji FROM rewards WHERE active = true ORDER BY cost ASC"
  );
  return NextResponse.json({ rewards });
}
