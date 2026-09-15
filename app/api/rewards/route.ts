import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";

export const dynamic = "force-dynamic";

// GET: the reward catalog. Names/costs/emoji are not sensitive, so this is
// readable without a session (kids see it right after logging in, but there's
// no harm in the catalog itself being visible).
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("rewards")
    .select("id, name, cost, emoji")
    .eq("active", true)
    .order("cost", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rewards: data });
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

  const { data, error } = await supabaseAdmin()
    .from("rewards")
    .insert({ name, cost, emoji })
    .select("id, name, cost, emoji")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reward: data }, { status: 201 });
}
