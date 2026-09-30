import "server-only";
import { query, queryOne } from "@/lib/db";
import { toDraft, type RoundQuestionDraft } from "@/lib/buildRound";
import { effectiveAnswerSeconds, type Level } from "@/lib/config";
import type { QuestionRow } from "@/lib/types";

// Practice sets (db/migrations/018_practice_sets.sql): named groups of bank
// questions an admin assigns to a child as extra, unscored practice. Each set
// is split into fixed rounds, so a kid always sees "round 3 of 6" and a
// replayed round has the same questions (options re-shuffled). Practice
// rounds (rounds.kind = 'practice') earn no points and are kept out of every
// report, the skill map, streaks, checkup and review.

export interface PracticeRoundProgress {
  roundNo: number;
  questionCount: number;
  timesCompleted: number;
  bestCorrect: number | null;
  lastCorrect: number | null;
}

export interface PracticeSetProgress {
  id: string;
  title: string;
  description: string | null;
  totalQuestions: number;
  rounds: PracticeRoundProgress[];
  roundsDone: number;
}

async function roundProgress(childId: string, setIds: string[]): Promise<Map<string, PracticeRoundProgress[]>> {
  const [shape, played] = await Promise.all([
    query<{ set_id: string; round_no: number; n: string }>(
      `SELECT set_id, round_no, count(*) AS n FROM practice_set_questions
       WHERE set_id = ANY($1::uuid[]) GROUP BY 1, 2 ORDER BY 1, 2`,
      [setIds]
    ),
    query<{ set_id: string; round_no: number; correct_count: number }>(
      `SELECT practice_set_id AS set_id, practice_round_no AS round_no, correct_count FROM rounds
       WHERE child_id = $1 AND kind = 'practice' AND status = 'completed' AND practice_set_id = ANY($2::uuid[])
       ORDER BY completed_at ASC`,
      [childId, setIds]
    ),
  ]);
  const bySet = new Map<string, PracticeRoundProgress[]>();
  for (const row of shape) {
    const done = played.filter((p) => p.set_id === row.set_id && p.round_no === row.round_no);
    const list = bySet.get(row.set_id) ?? [];
    list.push({
      roundNo: row.round_no,
      questionCount: Number(row.n),
      timesCompleted: done.length,
      bestCorrect: done.length ? Math.max(...done.map((d) => d.correct_count)) : null,
      lastCorrect: done.length ? done[done.length - 1]!.correct_count : null,
    });
    bySet.set(row.set_id, list);
  }
  return bySet;
}

function toProgress(
  set: { id: string; title: string; description: string | null },
  rounds: PracticeRoundProgress[]
): PracticeSetProgress {
  return {
    id: set.id,
    title: set.title,
    description: set.description,
    totalQuestions: rounds.reduce((sum, r) => sum + r.questionCount, 0),
    rounds,
    roundsDone: rounds.filter((r) => r.timesCompleted > 0).length,
  };
}

/** The sets assigned to one child, with how far they've got in each. */
export async function getAssignedPracticeSets(childId: string): Promise<PracticeSetProgress[]> {
  const sets = await query<{ id: string; title: string; description: string | null }>(
    `SELECT s.id, s.title, s.description FROM practice_sets s
     JOIN practice_assignments a ON a.set_id = s.id
     WHERE a.child_id = $1 ORDER BY a.assigned_at ASC`,
    [childId]
  );
  if (sets.length === 0) return [];
  const progress = await roundProgress(childId, sets.map((s) => s.id));
  return sets.map((s) => toProgress(s, progress.get(s.id) ?? []));
}

/** Every set, with whether it's assigned to this child and their progress -
 * for the admin's Practice tab. */
export async function getPracticeSetsForAdmin(childId: string) {
  const sets = await query<{ id: string; title: string; description: string | null; assigned_at: string | null }>(
    `SELECT s.id, s.title, s.description, a.assigned_at FROM practice_sets s
     LEFT JOIN practice_assignments a ON a.set_id = s.id AND a.child_id = $1
     ORDER BY s.created_at ASC`,
    [childId]
  );
  if (sets.length === 0) return [];
  const progress = await roundProgress(childId, sets.map((s) => s.id));
  const answers = await query<{
    set_id: string;
    round_no: number;
    question_text: string;
    options: string[];
    correct_index: number;
    selected_index: number | null;
    is_correct: boolean;
    answered_at: string;
    seconds: string | null;
  }>(
    `SELECT r.practice_set_id AS set_id, r.practice_round_no AS round_no, rq.question_text, rq.options,
            rq.correct_index, rq.selected_index, rq.is_correct, rq.answered_at,
            EXTRACT(EPOCH FROM rq.answered_at - rq.shown_at) AS seconds
     FROM round_questions rq JOIN rounds r ON r.id = rq.round_id
     WHERE r.child_id = $1 AND r.kind = 'practice' AND rq.answered_at IS NOT NULL
     ORDER BY rq.answered_at DESC`,
    [childId]
  );
  return sets.map((s) => ({
    ...toProgress(s, progress.get(s.id) ?? []),
    assignedAt: s.assigned_at,
    answers: answers
      .filter((a) => a.set_id === s.id)
      .map((a) => ({
        roundNo: a.round_no,
        questionText: a.question_text,
        picked: a.selected_index !== null && a.selected_index >= 0 ? a.options[a.selected_index] ?? null : null,
        correctAnswer: a.options[a.correct_index] ?? "",
        isCorrect: a.is_correct,
        answeredAt: a.answered_at,
        seconds: a.seconds === null ? null : Math.round(Number(a.seconds)),
      })),
  }));
}

export async function isPracticeSetAssigned(childId: string, setId: string): Promise<boolean> {
  const row = await queryOne<{ set_id: string }>(
    "SELECT set_id FROM practice_assignments WHERE child_id = $1 AND set_id = $2",
    [childId, setId]
  );
  return row !== null;
}

/** One round of a set, in its fixed order, with options shuffled per serving
 * like every other bank question. */
export async function buildPracticeRoundQuestions(setId: string, roundNo: number): Promise<RoundQuestionDraft[]> {
  const rows = await query<QuestionRow>(
    `SELECT q.* FROM practice_set_questions p JOIN questions q ON q.id = p.question_id
     WHERE p.set_id = $1 AND p.round_no = $2 ORDER BY p.position ASC`,
    [setId, roundNo]
  );
  return rows.map(toDraft);
}

/** The countdown for one question. A practice round mixes levels, so each
 * question gets its own level's time (or the child's override, as always) and
 * its level is sent along so the quiz screen can say why the timer changed.
 * Every other round kind uses the round's level and sends no level. */
export async function questionTiming(
  round: { id: string; kind: string; level: number },
  position: number,
  answerSecondsOverride: number | null
): Promise<{ timeLimitSeconds: number; questionLevel: Level | null }> {
  if (round.kind !== "practice") {
    return { timeLimitSeconds: effectiveAnswerSeconds(round.level as Level, answerSecondsOverride), questionLevel: null };
  }
  const row = await queryOne<{ level: Level }>(
    `SELECT q.level FROM round_questions rq JOIN questions q ON q.id = rq.question_id
     WHERE rq.round_id = $1 AND rq.position = $2`,
    [round.id, position]
  );
  const level = row?.level ?? (round.level as Level);
  return { timeLimitSeconds: effectiveAnswerSeconds(level, answerSecondsOverride), questionLevel: level };
}
