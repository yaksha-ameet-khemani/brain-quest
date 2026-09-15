import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";
import type { PointTransactionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const balance = await getBalance(kid.childId);

  const recent = await query<Pick<PointTransactionRow, "id" | "type" | "amount" | "reason" | "created_at">>(
    `SELECT id, type, amount, reason, created_at FROM point_transactions
     WHERE child_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [kid.childId]
  );

  return NextResponse.json({ balance, recent });
}
