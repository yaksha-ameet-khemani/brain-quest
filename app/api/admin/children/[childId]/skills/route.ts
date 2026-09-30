import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { queryOne } from "@/lib/db";
import { buildSkillMap } from "@/lib/skillMap";

export const dynamic = "force-dynamic";

// The live skill map for one child (lib/skillMap.ts). Admin-only, like the
// 10-day reports it also appears in.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<{ level: number }>("SELECT level FROM children WHERE id = $1", [childId]);
  if (!child) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(await buildSkillMap(childId, child.level));
}
