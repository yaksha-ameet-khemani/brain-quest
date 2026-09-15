import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireKid } from "@/lib/requireKid";
import { sanitizeQuestion } from "@/lib/sanitizeQuestion";
import type { RoundQuestionRow, RoundRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string; position: string }> }
) {
  const { roundId, position } = await params;
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const round = await queryOne<Pick<RoundRow, "id" | "child_id" | "status">>(
    "SELECT id, child_id, status FROM rounds WHERE id = $1",
    [roundId]
  );
  if (!round || round.child_id !== kid.childId) {
    return NextResponse.json({ error: "Round not found." }, { status: 404 });
  }
  if (round.status !== "in_progress") {
    return NextResponse.json({ error: "This round is already finished." }, { status: 409 });
  }

  const pos = Number(position);

  // A kid can only ever fetch the next unanswered question, never jump ahead
  // (which would let a client pre-fetch every question's options/explanation
  // before answering earlier ones, or fiddle with timers out of order).
  const nextUnanswered = await queryOne<
    Pick<RoundQuestionRow, "position" | "category" | "question_text" | "options" | "shown_at">
  >(
    `SELECT position, category, question_text, options, shown_at FROM round_questions
     WHERE round_id = $1 AND answered_at IS NULL
     ORDER BY position ASC LIMIT 1`,
    [roundId]
  );

  if (!nextUnanswered || nextUnanswered.position !== pos) {
    return NextResponse.json({ error: "Wrong question position." }, { status: 409 });
  }

  // Always refresh shown_at to now - see the matching comment in
  // app/api/round/start/route.ts for why this can't be "only if null".
  const shownAt = new Date().toISOString();
  await queryOne("UPDATE round_questions SET shown_at = $1 WHERE round_id = $2 AND position = $3", [
    shownAt,
    roundId,
    pos,
  ]);

  return NextResponse.json({
    question: sanitizeQuestion({
      position: nextUnanswered.position,
      category: nextUnanswered.category,
      question_text: nextUnanswered.question_text,
      options: nextUnanswered.options,
      shown_at: shownAt,
    }),
  });
}
