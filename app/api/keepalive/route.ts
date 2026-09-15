import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Supabase free projects pause after ~7 days with no activity. This endpoint
// does one trivial read so a scheduled GitHub Actions workflow
// (.github/workflows/keepalive.yml, also free) can ping it weekly and keep
// the project warm - see docs/SETUP.md. Guarded by a shared secret so it
// isn't a wide-open public endpoint anyone can hit.
export async function GET(req: Request) {
  const secret = req.headers.get("x-keepalive-secret");
  if (!process.env.KEEPALIVE_SECRET || secret !== process.env.KEEPALIVE_SECRET) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await supabaseAdmin().from("rewards").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
