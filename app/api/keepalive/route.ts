import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Some free Postgres hosts (including Neon) auto-suspend an idle database's
// compute after a few minutes - normally invisible, since the next query
// just waits an extra moment for it to wake back up. This endpoint does one
// trivial read so a scheduled GitHub Actions workflow
// (.github/workflows/keepalive.yml, also free) can ping it periodically as a
// hedge against any provider's longer-term "delete/hibernate after very
// long inactivity" policy - see docs/SETUP.md. Guarded by a shared secret so
// it isn't a wide-open public endpoint anyone can hit.
export async function GET(req: Request) {
  const secret = req.headers.get("x-keepalive-secret");
  if (!process.env.KEEPALIVE_SECRET || secret !== process.env.KEEPALIVE_SECRET) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    await query("SELECT 1");
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
