import "server-only";
import { query } from "@/lib/db";
import { todayRangeUtc } from "@/lib/timezone";

export interface CheckupProgress {
  pendingCount: number; // distinct bank questions + math skills currently "still wrong" for this child
  checkupDoneToday: boolean;
  checkupAvailableToday: boolean; // something to check up on AND not done yet today
}

/** Whether a child owes today's "checkup" before their next standard round
 * - see lib/buildRound.ts's buildCheckupQuestions() for what gets served.
 * Cheap count-only query; the actual substitute/regenerated questions are
 * only picked once round/start actually builds the round. */
export async function getCheckupProgress(childId: string): Promise<CheckupProgress> {
  const wrongBankRow = await query<{ count: string }>(
    `SELECT count(*) FROM (
       SELECT DISTINCT ON (rq.question_id) rq.question_id, rq.is_correct
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'bank' AND rq.question_id IS NOT NULL AND rq.answered_at IS NOT NULL
       ORDER BY rq.question_id, rq.answered_at DESC
     ) latest
     JOIN questions q ON q.id = latest.question_id
     WHERE latest.is_correct = false AND q.is_active = true`,
    [childId]
  );

  const wrongGeneratedRow = await query<{ count: string }>(
    `SELECT count(*) FROM (
       SELECT DISTINCT ON (rq.template_key) rq.template_key, rq.is_correct
       FROM round_questions rq
       JOIN rounds r ON r.id = rq.round_id
       WHERE r.child_id = $1 AND rq.source = 'generated' AND rq.template_key IS NOT NULL AND rq.answered_at IS NOT NULL
       ORDER BY rq.template_key, rq.answered_at DESC
     ) latest
     WHERE latest.is_correct = false`,
    [childId]
  );

  const pendingCount = Number(wrongBankRow[0]?.count ?? 0) + Number(wrongGeneratedRow[0]?.count ?? 0);

  const { start, end } = todayRangeUtc();
  const doneRow = await query<{ count: string }>(
    `SELECT count(*) FROM rounds WHERE child_id = $1 AND kind = 'checkup' AND started_at >= $2 AND started_at < $3`,
    [childId, start.toISOString(), end.toISOString()]
  );
  const checkupDoneToday = Number(doneRow[0]?.count ?? 0) > 0;

  return {
    pendingCount,
    checkupDoneToday,
    checkupAvailableToday: pendingCount > 0 && !checkupDoneToday,
  };
}
