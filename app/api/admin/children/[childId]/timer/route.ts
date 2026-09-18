import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { EXPLANATION_MIN_READ_SECONDS, LEVELS, type Level } from "@/lib/config";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type TimerRow = Pick<ChildRow, "level" | "answer_seconds" | "explain_seconds">;

function toResponse(row: TimerRow) {
  return {
    answerSeconds: row.answer_seconds,
    levelDefaultSeconds: LEVELS[row.level as Level].perQuestionSeconds,
    explainSeconds: row.explain_seconds,
    explainDefaultSeconds: EXPLANATION_MIN_READ_SECONDS,
  };
}

// GET/PUT/DELETE: a child's two timer overrides - answerSeconds (how long
// they get per question, 10-300s) and explainSeconds (how long the
// explanation screen forces them to wait before "Next question" unlocks,
// 0-60s, 0 = no forced wait). Admin-only. PUT adds or updates whichever
// field(s) are present in the body; DELETE clears one field (given by
// `field` in the body) back to its default - see lib/config.ts's
// effectiveAnswerSeconds() / effectiveExplainSeconds().
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const child = await queryOne<TimerRow>(
    "SELECT level, answer_seconds, explain_seconds FROM children WHERE id = $1",
    [childId]
  );
  if (!child) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json(toResponse(child));
}

export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const hasAnswerSeconds = body?.answerSeconds !== undefined;
  const hasExplainSeconds = body?.explainSeconds !== undefined;
  if (!hasAnswerSeconds && !hasExplainSeconds) {
    return NextResponse.json({ error: "Provide answerSeconds and/or explainSeconds." }, { status: 400 });
  }

  let answerSeconds: number | undefined;
  if (hasAnswerSeconds) {
    answerSeconds = body.answerSeconds;
    if (
      typeof answerSeconds !== "number" ||
      !Number.isInteger(answerSeconds) ||
      answerSeconds < 10 ||
      answerSeconds > 300
    ) {
      return NextResponse.json(
        { error: "Answer timer must be a whole number of seconds between 10 and 300." },
        { status: 400 }
      );
    }
  }

  let explainSeconds: number | undefined;
  if (hasExplainSeconds) {
    explainSeconds = body.explainSeconds;
    if (
      typeof explainSeconds !== "number" ||
      !Number.isInteger(explainSeconds) ||
      explainSeconds < 0 ||
      explainSeconds > 60
    ) {
      return NextResponse.json(
        { error: "Explanation timer must be a whole number of seconds between 0 and 60." },
        { status: 400 }
      );
    }
  }

  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (hasAnswerSeconds) {
    values.push(answerSeconds!);
    sets.push(`answer_seconds = $${values.length}`);
  }
  if (hasExplainSeconds) {
    values.push(explainSeconds!);
    sets.push(`explain_seconds = $${values.length}`);
  }
  values.push(childId);

  const updated = await queryOne<TimerRow>(
    `UPDATE children SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING level, answer_seconds, explain_seconds`,
    values
  );
  if (!updated) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json(toResponse(updated));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const field = body?.field;
  if (field !== "answerSeconds" && field !== "explainSeconds") {
    return NextResponse.json({ error: "field must be 'answerSeconds' or 'explainSeconds'." }, { status: 400 });
  }
  const column = field === "answerSeconds" ? "answer_seconds" : "explain_seconds";

  const updated = await queryOne<TimerRow>(
    `UPDATE children SET ${column} = NULL WHERE id = $1 RETURNING level, answer_seconds, explain_seconds`,
    [childId]
  );
  if (!updated) return NextResponse.json({ error: "Child not found." }, { status: 404 });

  return NextResponse.json(toResponse(updated));
}
