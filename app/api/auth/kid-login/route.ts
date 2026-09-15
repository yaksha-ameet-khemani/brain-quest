import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPin } from "@/lib/pin";
import { createKidSessionToken, KID_COOKIE_NAME, kidCookieOptions } from "@/lib/kidSession";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ChildRow } from "@/lib/types";

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

  const child = await queryOne<ChildRow>(
    "SELECT id, name, avatar, level, pin_hash FROM children WHERE id = $1",
    [childId]
  );

  if (!child || !verifyPin(pin, child.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  // Fire-and-forget-ish, but awaited so a failure here surfaces rather than
  // silently losing a login record - it's one cheap insert.
  await queryOne("INSERT INTO child_logins (child_id) VALUES ($1)", [child.id]);

  const token = createKidSessionToken(child.id);
  const res = NextResponse.json({
    child: { id: child.id, name: child.name, avatar: child.avatar, level: child.level },
  });
  res.cookies.set(KID_COOKIE_NAME, token, kidCookieOptions);
  return res;
}
