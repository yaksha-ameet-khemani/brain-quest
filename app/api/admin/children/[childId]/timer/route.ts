import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { LEVELS, type Level } from "@/lib/config";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET/PUT/DELETE: a child's per-question answer timer override, in seconds
// (10-300). Admin-only. PUT adds or updates it; DELETE clears it back to
// the level default (LEVELS[level].perQuestionSeconds) - see
// lib/config.ts's effectiveAnswerSeconds().
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<Pick<ChildRow, "level" | "answer_seconds">>(
    "SELECT level, answer_seconds FROM children WHERE id = $1",
    [childId]
  );
  if (!child) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json({
    answerSeconds: child.answer_seconds,
    levelDefaultSeconds: LEVELS[child.level as Level].perQuestionSeconds,
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const answerSeconds: unknown = body?.answerSeconds;
  if (typeof answerSeconds !== "number" || !Number.isInteger(answerSeconds) || answerSeconds < 10 || answerSeconds > 300) {
    return NextResponse.json({ error: "Timer must be a whole number of seconds between 10 and 300." }, { status: 400 });
  }

  const updated = await queryOne<Pick<ChildRow, "level" | "answer_seconds">>(
    "UPDATE children SET answer_seconds = $1 WHERE id = $2 RETURNING level, answer_seconds",
    [answerSeconds, childId]
  );
  if (!updated) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json({
    answerSeconds: updated.answer_seconds,
    levelDefaultSeconds: LEVELS[updated.level as Level].perQuestionSeconds,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const updated = await queryOne<Pick<ChildRow, "level" | "answer_seconds">>(
    "UPDATE children SET answer_seconds = NULL WHERE id = $1 RETURNING level, answer_seconds",
    [childId]
  );
  if (!updated) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json({
    answerSeconds: updated.answer_seconds,
    levelDefaultSeconds: LEVELS[updated.level as Level].perQuestionSeconds,
  });
}
