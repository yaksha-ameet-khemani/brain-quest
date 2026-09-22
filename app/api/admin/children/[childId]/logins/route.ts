import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const RECENT_LOGIN_COUNT = 10;

// The N most recent login instants for one child, newest first. Admin-only,
// same as the family-wide activity summary this mirrors per-child.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const rows = await query<{ logged_in_at: string }>(
    `SELECT logged_in_at FROM child_logins WHERE child_id = $1 ORDER BY logged_in_at DESC LIMIT $2`,
    [childId, RECENT_LOGIN_COUNT]
  );

  return NextResponse.json({ logins: rows.map((r) => new Date(r.logged_in_at).toISOString()) });
}
