import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
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

  const existing = await queryOne("SELECT id FROM children WHERE id = $1", [childId]);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await queryOne("UPDATE children SET pin_hash = $1 WHERE id = $2", [hashPin(pin), childId]);
  return NextResponse.json({ ok: true });
}
