import "server-only";
import { query } from "@/lib/db";
import { todayRangeUtc } from "@/lib/timezone";
import { REVIEW_ROUNDS_PER_DAY } from "@/lib/config";

export interface ReviewProgress {
  wrongQuestionCount: number; // how many bank questions are currently "still wrong" for this child
  reviewRoundsUsedToday: number;
  reviewAvailableToday: boolean; // has quota left AND has something to review
}

/** Whether a child can start a review round right now - see
 * lib/buildRound.ts's buildReviewQuestions() for what "wrong" means (most
 * recent attempt on a bank question was incorrect). Cheap count-only query;
 * the actual questions are only picked once a review round is started. */
export async function getReviewProgress(childId: string): Promise<ReviewProgress> {
  const wrongRow = await query<{ count: string }>(
    `SELECT count(*) FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1
         AND rq.source = 'bank'
         AND rq.question_id IS NOT NULL
         AND rq.answered_at IS NOT NULL
       ORDER BY rq.question_id, rq.answered_at DESC
     ) latest
     JOIN questions q ON q.id = latest.question_id
     WHERE latest.is_correct = false AND q.is_active = true`,
    [childId]
  );
  const wrongQuestionCount = Number(wrongRow[0]?.count ?? 0);

  const { start, end } = todayRangeUtc();
  const usedRow = await query<{ count: string }>(
    `SELECT count(*) FROM rounds
     WHERE child_id = $1 AND kind = 'review' AND started_at >= $2 AND started_at < $3`,
    [childId, start.toISOString(), end.toISOString()]
  );
  const reviewRoundsUsedToday = Number(usedRow[0]?.count ?? 0);

  return {
    wrongQuestionCount,
    reviewRoundsUsedToday,
    reviewAvailableToday: wrongQuestionCount > 0 && reviewRoundsUsedToday < REVIEW_ROUNDS_PER_DAY,
  };
}
