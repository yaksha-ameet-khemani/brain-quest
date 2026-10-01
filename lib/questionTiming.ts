import "server-only";
import { queryOne } from "@/lib/db";
import { getPenPaperSeconds } from "@/lib/gameSettings";
import { effectiveAnswerSeconds, type Level } from "@/lib/config";

/** The countdown for one served question, and what the quiz screen should
 * say about it:
 * - normally the round's level default, or the child's own override;
 * - a practice round mixes levels (lib/practice.ts), so there it is the
 *   question's own level, and that level is sent along so the quiz screen
 *   can say why the timer changed;
 * - a pen & paper question (round_questions.pen_paper) gets the admin's
 *   pen & paper time (game_settings.pen_paper_seconds), or the child's
 *   normal time if that is longer. */
export async function questionTiming(
  round: { id: string; kind: string; level: number },
  position: number,
  answerSecondsOverride: number | null
): Promise<{ timeLimitSeconds: number; questionLevel: Level | null; penPaper: boolean }> {
  const row = await queryOne<{ pen_paper: boolean; question_level: Level | null }>(
    `SELECT rq.pen_paper, q.level AS question_level FROM round_questions rq
     LEFT JOIN questions q ON q.id = rq.question_id
     WHERE rq.round_id = $1 AND rq.position = $2`,
    [round.id, position]
  );
  const isPractice = round.kind === "practice";
  const level = isPractice && row?.question_level ? row.question_level : (round.level as Level);
  const normal = effectiveAnswerSeconds(level, answerSecondsOverride);
  const penPaper = row?.pen_paper === true;
  return {
    timeLimitSeconds: penPaper ? Math.max(normal, await getPenPaperSeconds()) : normal,
    questionLevel: isPractice ? level : null,
    penPaper,
  };
}
