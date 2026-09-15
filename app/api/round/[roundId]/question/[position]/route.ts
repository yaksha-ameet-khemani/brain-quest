import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireKid } from "@/lib/requireKid";
import { sanitizeQuestion } from "@/lib/sanitizeQuestion";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roundId: string; position: string }> }
) {
  const { roundId, position } = await params;
  const kid = await requireKid();
  if (!kid) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: round } = await db
    .from("rounds")
    .select("id, child_id, status")
    .eq("id", roundId)
    .single();
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
  const { data: nextUnanswered } = await db
    .from("round_questions")
    .select("position, category, question_text, options, shown_at")
    .eq("round_id", roundId)
    .is("answered_at", null)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextUnanswered || nextUnanswered.position !== pos) {
    return NextResponse.json({ error: "Wrong question position." }, { status: 409 });
  }

  if (!nextUnanswered.shown_at) {
    const shownAt = new Date().toISOString();
    await db.from("round_questions").update({ shown_at: shownAt }).eq("round_id", roundId).eq("position", pos);
    nextUnanswered.shown_at = shownAt;
  }

  return NextResponse.json({ question: sanitizeQuestion(nextUnanswered) });
}
