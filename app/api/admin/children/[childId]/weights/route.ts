import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireParent";
import { getCategoryWeights, setCategoryWeights } from "@/lib/categoryWeights";
import { CATEGORIES } from "@/lib/config";

export const dynamic = "force-dynamic";

// GET/PUT: a child's per-category priority weights - how often each
// category should come up in their rounds. Admin-only: this is the "give
// child 2 more logic practice since they're weak there" control.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const weights = await getCategoryWeights(childId);
  return NextResponse.json({ weights });
}

export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const weights: Record<string, unknown> = body?.weights ?? {};

  const clean: Partial<Record<(typeof CATEGORIES)[number], number>> = {};
  for (const category of CATEGORIES) {
    const value = weights[category];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
      return NextResponse.json(
        { error: `${category} weight must be a whole number between 0 and 100.` },
        { status: 400 }
      );
    }
    clean[category] = value;
  }

  await setCategoryWeights(childId, clean);
  const updated = await getCategoryWeights(childId);
  return NextResponse.json({ weights: updated });
}
