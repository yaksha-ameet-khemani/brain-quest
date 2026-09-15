import { NextResponse } from "next/server";
import { KID_COOKIE_NAME } from "@/lib/kidSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(KID_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
