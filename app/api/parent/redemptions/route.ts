import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";

export const dynamic = "force-dynamic";

// GET: every redemption request across all children, newest first.
export async function GET() {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("redemptions")
    .select("id, child_id, reward_name, cost, status, requested_at, decided_at, note")
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Two-step instead of an embedded `children(...)` select - simpler to type
  // correctly and just as cheap at this data size.
  const { data: children } = await db.from("children").select("id, name, avatar");
  const childById = new Map((children ?? []).map((c) => [c.id, c]));

  const redemptions = (data ?? []).map((r) => ({
    ...r,
    child: childById.has(r.child_id)
      ? { name: childById.get(r.child_id)!.name, avatar: childById.get(r.child_id)!.avatar }
      : null,
  }));

  return NextResponse.json({ redemptions });
}

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

  const VALID_ACTIONS = ["approve", "deny", "fulfill"] as const;
  type Action = (typeof VALID_ACTIONS)[number];
  if (!redemptionId || !VALID_ACTIONS.includes(rawAction as Action)) {
    return NextResponse.json({ error: "redemptionId and a valid action are required." }, { status: 400 });
  }
  const action: Action = rawAction as Action;

  const db = supabaseAdmin();
  const { data: redemption } = await db
    .from("redemptions")
    .select("id, child_id, cost, reward_name, status")
    .eq("id", redemptionId)
    .single();
  if (!redemption) return NextResponse.json({ error: "Not found." }, { status: 404 });

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
  } as const satisfies Record<string, "approved" | "denied" | "fulfilled">;

  const { data: updated, error: updateError } = await db
    .from("redemptions")
    .update({
      status: statusMap[action],
      decided_at: new Date().toISOString(),
      decided_by: parent.id,
      note: note ?? null,
    })
    .eq("id", redemptionId)
    .select("id, status")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (action === "deny") {
    await db.from("point_transactions").insert({
      child_id: redemption.child_id,
      type: "refund",
      amount: redemption.cost,
      reason: `Refund: ${redemption.reward_name} request denied`,
      redemption_id: redemption.id,
    });
  }

  return NextResponse.json({ redemption: updated });
}
