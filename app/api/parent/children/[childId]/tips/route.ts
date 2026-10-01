import { NextResponse } from "next/server";
import { requireParent } from "@/lib/requireParent";
import { ownedChild } from "@/lib/childOwnership";
import { listSavedTips } from "@/lib/tips";

export const dynamic = "force-dynamic";

// GET: every saved 3-day tip set for a child, newest first, with the reasons
// and example mistakes behind each tip (lib/tips.ts). A parent sees their own
// children's; the admin sees any child's.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  if (!(await ownedChild(childId, parent))) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ tips: await listSavedTips(childId) });
}
