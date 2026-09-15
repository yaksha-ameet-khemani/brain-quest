import { NextResponse } from "next/server";
import { PARENT_COOKIE_NAME } from "@/lib/parentSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARENT_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
