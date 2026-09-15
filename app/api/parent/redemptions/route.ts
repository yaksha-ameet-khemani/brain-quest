import { NextResponse } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { ownedChild } from "@/lib/childOwnership";
import type { ChildRow, RedemptionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: redemption requests, newest first - every child's for admin, only
// your own children's for a parent.
export async function GET() {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const children =
    parent.role === "admin"
      ? await query<Pick<ChildRow, "id" | "name" | "avatar">>("SELECT id, name, avatar FROM children")
      : await query<Pick<ChildRow, "id" | "name" | "avatar">>(
          "SELECT id, name, avatar FROM children WHERE parent_id = $1",
          [parent.id]
        );
  const childById = new Map(children.map((c) => [c.id, c]));

  const rows =
    parent.role === "admin"
      ? await query<
          Pick<
            RedemptionRow,
            "id" | "child_id" | "reward_name" | "cost" | "status" | "requested_at" | "decided_at" | "note"
          >
        >(
          `SELECT id, child_id, reward_name, cost, status, requested_at, decided_at, note
           FROM redemptions ORDER BY requested_at DESC LIMIT 100`
        )
      : await query<
          Pick<
            RedemptionRow,
            "id" | "child_id" | "reward_name" | "cost" | "status" | "requested_at" | "decided_at" | "note"
          >
        >(
          `SELECT id, child_id, reward_name, cost, status, requested_at, decided_at, note
           FROM redemptions WHERE child_id = ANY($1::uuid[]) ORDER BY requested_at DESC LIMIT 100`,
          [children.map((c) => c.id)]
        );

  const redemptions = rows.map((r) => ({
    ...r,
    child: childById.has(r.child_id)
      ? { name: childById.get(r.child_id)!.name, avatar: childById.get(r.child_id)!.avatar }
      : null,
  }));

  return NextResponse.json({ redemptions });
}

const VALID_ACTIONS = ["approve", "deny", "fulfill"] as const;
type Action = (typeof VALID_ACTIONS)[number];

// POST: approve, deny, or fulfill a pending/approved request.
// - deny: refunds the points that were debited at request time.
// - approve: marks it as agreed-to, points stay spent (already debited).
// - fulfill: marks the reward as actually handed over (e.g. after the outing).
export async function POST(req: Request) {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const redemptionId: string | undefined = body?.redemptionId;
  const rawAction: string | undefined = body?.action;
  const note: string | undefined = body?.note;

  if (!redemptionId || !VALID_ACTIONS.includes(rawAction as Action)) {
    return NextResponse.json({ error: "redemptionId and a valid action are required." }, { status: 400 });
  }
  const action: Action = rawAction as Action;

  const redemption = await queryOne<Pick<RedemptionRow, "id" | "child_id" | "cost" | "reward_name" | "status">>(
    "SELECT id, child_id, cost, reward_name, status FROM redemptions WHERE id = $1",
    [redemptionId]
  );
  if (!redemption) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await ownedChild(redemption.child_id, parent))) {
    return NextResponse.json({ error: "That's not your child's request to decide." }, { status: 403 });
  }

  if (action === "deny" && redemption.status !== "pending") {
    return NextResponse.json({ error: "Only a pending request can be denied." }, { status: 409 });
  }
  if (action === "fulfill" && redemption.status !== "approved") {
    return NextResponse.json({ error: "Approve the request before fulfilling it." }, { status: 409 });
  }

  const statusMap = {
    approve: "approved",
    deny: "denied",
    fulfill: "fulfilled",
  } as const satisfies Record<Action, "approved" | "denied" | "fulfilled">;

  const updated = await withTransaction(async (tx) => {
    const result = await tx.query(
      `UPDATE redemptions SET status = $1, decided_at = now(), decided_by = $2, note = $3
       WHERE id = $4 RETURNING id, status`,
      [statusMap[action], parent.id, note ?? null, redemptionId]
    );

    if (action === "deny") {
      await tx.query(
        `INSERT INTO point_transactions (child_id, type, amount, reason, redemption_id)
         VALUES ($1, 'refund', $2, $3, $4)`,
        [redemption.child_id, redemption.cost, `Refund: ${redemption.reward_name} request denied`, redemption.id]
      );
    }

    return result.rows[0];
  });

  return NextResponse.json({ redemption: updated });
}
