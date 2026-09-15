import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";

// GET: the signed-in kid's own redemption history.
export async function GET() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from("redemptions")
    .select("id, reward_name, cost, status, requested_at, decided_at, note")
    .eq("child_id", kid.childId)
    .order("requested_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ redemptions: data });
}

// POST: request a reward. Points are debited immediately (a 'redeem' ledger
// entry) so a pending request can't be double-spent; denying it later
// refunds the points (see app/api/parent/redemptions).
export async function POST(req: Request) {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rewardId: string | undefined = body?.rewardId;
  if (!rewardId) return NextResponse.json({ error: "rewardId is required." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: reward } = await db
    .from("rewards")
    .select("id, name, cost, active")
    .eq("id", rewardId)
    .single();
  if (!reward || !reward.active) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }

  const balance = await getBalance(kid.childId);
  if (balance < reward.cost) {
    return NextResponse.json(
      { error: `Not enough points yet. You have ${balance}, this costs ${reward.cost}.` },
      { status: 400 }
    );
  }

  const { data: redemption, error: redemptionError } = await db
    .from("redemptions")
    .insert({
      child_id: kid.childId,
      reward_id: reward.id,
      reward_name: reward.name,
      cost: reward.cost,
      status: "pending",
    })
    .select("id, reward_name, cost, status, requested_at")
    .single();
  if (redemptionError || !redemption) {
    return NextResponse.json({ error: redemptionError?.message ?? "Could not create request." }, { status: 500 });
  }

  await db.from("point_transactions").insert({
    child_id: kid.childId,
    type: "redeem",
    amount: -reward.cost,
    reason: `Requested: ${reward.name}`,
    redemption_id: redemption.id,
  });

  const newBalance = await getBalance(kid.childId);
  return NextResponse.json({ redemption, newBalance }, { status: 201 });
}
