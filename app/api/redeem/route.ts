import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";
import type { RedemptionRow, RewardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: the signed-in kid's own redemption history.
export async function GET() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const redemptions = await query<
    Pick<RedemptionRow, "id" | "reward_name" | "cost" | "status" | "requested_at" | "decided_at" | "note">
  >(
    `SELECT id, reward_name, cost, status, requested_at, decided_at, note
     FROM redemptions WHERE child_id = $1 ORDER BY requested_at DESC`,
    [kid.childId]
  );
  return NextResponse.json({ redemptions });
}

// POST: request a reward. Points are debited immediately (a 'redeem' ledger
// entry) so a pending request can't be double-spent; denying it later
// refunds the points (see app/api/parent/redemptions). The whole
// check-then-debit runs in one transaction with the child row locked, so two
// requests fired at once can't both slip past the balance check.
export async function POST(req: Request) {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rewardId: string | undefined = body?.rewardId;
  if (!rewardId) return NextResponse.json({ error: "rewardId is required." }, { status: 400 });

  const reward = await queryOne<Pick<RewardRow, "id" | "name" | "cost" | "active">>(
    "SELECT id, name, cost, active FROM rewards WHERE id = $1",
    [rewardId]
  );
  if (!reward || !reward.active) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }

  try {
    const redemption = await withTransaction(async (tx) => {
      await tx.query("SELECT id FROM children WHERE id = $1 FOR UPDATE", [kid.childId]);

      const balanceRow = await tx.query(
        "SELECT COALESCE(SUM(amount), 0) AS sum FROM point_transactions WHERE child_id = $1",
        [kid.childId]
      );
      const balance = Number(balanceRow.rows[0]?.sum ?? 0);
      if (balance < reward.cost) {
        throw new InsufficientPointsError(balance, reward.cost);
      }

      const inserted = await tx.query(
        `INSERT INTO redemptions (child_id, reward_id, reward_name, cost, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, reward_name, cost, status, requested_at`,
        [kid.childId, reward.id, reward.name, reward.cost]
      );
      const row = inserted.rows[0];

      await tx.query(
        `INSERT INTO point_transactions (child_id, type, amount, reason, redemption_id)
         VALUES ($1, 'redeem', $2, $3, $4)`,
        [kid.childId, -reward.cost, `Requested: ${reward.name}`, row.id]
      );

      return row;
    });

    const newBalance = await getBalance(kid.childId);
    return NextResponse.json({ redemption, newBalance }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientPointsError) {
      return NextResponse.json(
        { error: `Not enough points yet. You have ${err.balance}, this costs ${err.cost}.` },
        { status: 400 }
      );
    }
    throw err;
  }
}

class InsufficientPointsError extends Error {
  constructor(public balance: number, public cost: number) {
    super("Insufficient points");
  }
}
