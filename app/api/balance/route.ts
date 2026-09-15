import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireKid } from "@/lib/requireKid";
import { getBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";

export async function GET() {
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const balance = await getBalance(kid.childId);

  const { data: recent } = await supabaseAdmin()
    .from("point_transactions")
    .select("id, type, amount, reason, created_at")
    .eq("child_id", kid.childId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ balance, recent: recent ?? [] });
}
