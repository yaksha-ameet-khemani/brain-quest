import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { verifyPin } from "@/lib/pin";
import { createKidSessionToken, KID_COOKIE_NAME, kidCookieOptions } from "@/lib/kidSession";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const childId: string | undefined = body?.childId;
  const pin: string | undefined = body?.pin;

  if (!childId || !pin) {
    return NextResponse.json({ error: "childId and pin are required." }, { status: 400 });
  }

  // 5 attempts per child per minute - plenty for a kid who fumbles their own
  // PIN, not enough to brute-force a 4-digit code in any reasonable time.
  if (!checkRateLimit(`kid-login:${childId}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const { data: child, error } = await supabaseAdmin()
    .from("children")
    .select("id, name, avatar, level, pin_hash")
    .eq("id", childId)
    .single();

  if (error || !child || !verifyPin(pin, child.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  const token = createKidSessionToken(child.id);
  const res = NextResponse.json({
    child: { id: child.id, name: child.name, avatar: child.avatar, level: child.level },
  });
  res.cookies.set(KID_COOKIE_NAME, token, kidCookieOptions);
  return res;
}
