import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const pin: string | undefined = body?.pin;
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "A 4-6 digit pin is required." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: child } = await db.from("children").select("id, parent_id").eq("id", childId).single();
  if (!child || child.parent_id !== parent.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { error } = await db.from("children").update({ pin_hash: hashPin(pin) }).eq("id", childId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
