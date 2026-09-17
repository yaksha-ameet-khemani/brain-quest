import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import type { RewardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RewardWithStats extends RewardRow {
  times_redeemed: string;
}

// GET: every reward (active and archived), with how many times each has
// been redeemed. Admin-only; the kid-facing catalog (GET /api/rewards)
// stays separate and only ever shows active ones.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const rows = await query<RewardWithStats>(`
    SELECT
      rw.*,
      COALESCE(rd.times_redeemed, 0) AS times_redeemed
    FROM rewards rw
    LEFT JOIN (
      SELECT reward_id, count(*) AS times_redeemed
      FROM redemptions
      WHERE reward_id IS NOT NULL
      GROUP BY reward_id
    ) rd ON rd.reward_id = rw.id
    ORDER BY rw.cost ASC
  `);

  const rewards = rows.map((r) => ({
    id: r.id,
    name: r.name,
    cost: r.cost,
    emoji: r.emoji,
    isActive: r.active,
    timesRedeemed: Number(r.times_redeemed),
  }));

  return NextResponse.json({ rewards });
}

// POST: add a new reward to the catalog. Admin-only.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const cost: number = Number(body?.cost);
  const emoji: string = body?.emoji?.trim() || "🎁";

  if (!name || !Number.isInteger(cost) || cost <= 0) {
    return NextResponse.json({ error: "name and a positive integer cost are required." }, { status: 400 });
  }

  const reward = await queryOne<RewardRow>(
    "INSERT INTO rewards (name, cost, emoji) VALUES ($1, $2, $3) RETURNING *",
    [name, cost, emoji]
  );
  if (!reward) return NextResponse.json({ error: "Could not create reward." }, { status: 500 });
  return NextResponse.json({ reward }, { status: 201 });
}
