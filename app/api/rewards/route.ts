import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import type { RewardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: the reward catalog. Names/costs/emoji are not sensitive, so this is
// readable without a session (kids see it right after logging in, but there's
// no harm in the catalog itself being visible).
export async function GET() {
  const rewards = await query<Pick<RewardRow, "id" | "name" | "cost" | "emoji">>(
    "SELECT id, name, cost, emoji FROM rewards WHERE active = true ORDER BY cost ASC"
  );
  return NextResponse.json({ rewards });
}

// POST: add a new reward to the catalog. Parent-only.
export async function POST(req: Request) {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const cost: number = Number(body?.cost);
  const emoji: string = body?.emoji?.trim() || "🎁";

  if (!name || !Number.isInteger(cost) || cost <= 0) {
    return NextResponse.json({ error: "name and a positive integer cost are required." }, { status: 400 });
  }

  const reward = await queryOne<Pick<RewardRow, "id" | "name" | "cost" | "emoji">>(
    "INSERT INTO rewards (name, cost, emoji) VALUES ($1, $2, $3) RETURNING id, name, cost, emoji",
    [name, cost, emoji]
  );
  if (!reward) return NextResponse.json({ error: "Could not create reward." }, { status: 500 });
  return NextResponse.json({ reward }, { status: 201 });
}
