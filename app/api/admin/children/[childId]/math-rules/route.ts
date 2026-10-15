import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { listMathRules, setMathRules, type MathRule } from "@/lib/mathRules";
import type { Level } from "@/lib/config";

export const dynamic = "force-dynamic";

const RULES: MathRule[] = ["normal", "weekly", "never"];

async function childLevel(childId: string): Promise<Level | null> {
  const row = await queryOne<{ level: Level }>("SELECT level FROM children WHERE id = $1", [childId]);
  return row?.level ?? null;
}

// GET/PUT: a child's math question type rules (lib/mathRules.ts) - for each
// generated math template they can meet (their level and the bonus level
// above), normal / at most once a week / never. Admin-only, like the
// section priorities and timers.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const level = await childLevel(childId);
  if (!level) return NextResponse.json({ error: "Child not found." }, { status: 404 });
  return NextResponse.json({ types: await listMathRules(childId, level) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const level = await childLevel(childId);
  if (!level) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const rules: Record<string, unknown> = body?.rules ?? {};
  const known = new Set((await listMathRules(childId, level)).map((t) => t.key));
  const clean: Record<string, MathRule> = {};
  for (const [key, rule] of Object.entries(rules)) {
    if (!known.has(key)) return NextResponse.json({ error: `Unknown math type: ${key}` }, { status: 400 });
    if (!RULES.includes(rule as MathRule)) {
      return NextResponse.json({ error: `Rule must be one of ${RULES.join(", ")}.` }, { status: 400 });
    }
    clean[key] = rule as MathRule;
  }

  await setMathRules(childId, clean);
  return NextResponse.json({ types: await listMathRules(childId, level) });
}
