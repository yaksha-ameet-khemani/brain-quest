import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

// GET: the profile picker screen on the home page needs to know who can play
// - name, avatar, level. Never the pin hash. This is a single-household
// deployment (see docs/SETUP.md), so every child in the table is shown; it
// is not a multi-family public listing.
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("children")
    .select("id, name, avatar, level")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ children: data });
}

// POST: create a new kid profile. Parent-only.
export async function POST(req: Request) {
  const parent = await requireParent();
  if (!parent) {
    return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const level: number | undefined = body?.level;
  const pin: string | undefined = body?.pin;
  const avatar: string = body?.avatar?.trim() || "🙂";

  if (!name || (level !== 1 && level !== 2) || !pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: "name, level (1 or 2), and a 4-6 digit pin are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("children")
    .insert({
      parent_id: parent.id,
      name,
      level,
      avatar,
      pin_hash: hashPin(pin),
    })
    .select("id, name, avatar, level")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ child: data }, { status: 201 });
}
