import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { BANK_CATEGORIES, isValidLevel, type BankCategory, type Level } from "@/lib/config";
import type { QuestionRow } from "@/lib/types";
import { loadSkills } from "@/lib/loadSkills";

export const dynamic = "force-dynamic";

interface QuestionWithStats extends QuestionRow {
  attempts: string;
  correct: string;
}

// GET: every bank question with its "proficiency" - how often kids serving
// this exact question have gotten it right. Admin-only; this is the same
// question content the kid-facing routes carefully never expose the answer
// side of, deliberately shown here in full since it's the admin's own
// content to manage.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const [rows, skills] = await Promise.all([query<QuestionWithStats>(`
    SELECT
      q.*,
      COALESCE(s.attempts, 0) AS attempts,
      COALESCE(s.correct, 0) AS correct
    FROM questions q
    LEFT JOIN (
      SELECT question_id, count(*) AS attempts, count(*) FILTER (WHERE is_correct) AS correct
      FROM round_questions
      WHERE question_id IS NOT NULL AND answered_at IS NOT NULL
      GROUP BY question_id
    ) s ON s.question_id = q.id
    ORDER BY q.level, q.category, q.created_at
  `), loadSkills()]);

  const questions = rows.map((r) => ({
    id: r.id,
    level: r.level,
    category: r.category,
    questionText: r.question_text,
    options: r.options,
    correctOptionIndex: r.correct_option_index,
    explanation: r.explanation,
    concept: r.concept,
    skillKey: r.skill_key,
    skillStep: r.skill_step,
    isActive: r.is_active,
    inRotation: r.in_rotation,
    penPaper: r.pen_paper,
    attempts: Number(r.attempts),
    correct: Number(r.correct),
    successRate: Number(r.attempts) > 0 ? Number(r.correct) / Number(r.attempts) : null,
  }));

  return NextResponse.json({ questions, skills });
}

// POST: add a new bank question. Admin-only.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const level: Level | undefined = body?.level;
  const category: BankCategory | undefined = body?.category;
  const questionText: string | undefined = body?.questionText?.trim();
  const options: string[] | undefined = body?.options;
  const correctOptionIndex: number | undefined = body?.correctOptionIndex;
  const explanation: string | undefined = body?.explanation?.trim();
  const concept: string | null = typeof body?.concept === "string" && body.concept.trim() ? body.concept.trim() : null;
  const skillKey: string | null = typeof body?.skillKey === "string" && body.skillKey ? body.skillKey : null;
  const skillStep: number | null = [1, 2, 3].includes(body?.skillStep) ? body.skillStep : null;
  const penPaper = body?.penPaper === true;
  if (skillKey && !(await loadSkills()).some((s) => s.key === skillKey)) {
    return NextResponse.json({ error: "Unknown skill." }, { status: 400 });
  }

  if (
    !isValidLevel(level) ||
    !category ||
    !BANK_CATEGORIES.includes(category) ||
    !questionText ||
    !Array.isArray(options) ||
    options.length !== 4 ||
    options.some((o) => typeof o !== "string" || !o.trim()) ||
    typeof correctOptionIndex !== "number" ||
    correctOptionIndex < 0 ||
    correctOptionIndex > 3 ||
    !explanation
  ) {
    return NextResponse.json(
      { error: "level, category, questionText, exactly 4 non-empty options, correctOptionIndex (0-3), and explanation are all required." },
      { status: 400 }
    );
  }

  const question = await queryOne<QuestionRow>(
    `INSERT INTO questions (level, category, question_text, options, correct_option_index, explanation, concept, skill_key, skill_step, pen_paper)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [level, category, questionText, JSON.stringify(options), correctOptionIndex, explanation, concept, skillKey, skillStep, penPaper]
  );
  if (!question) return NextResponse.json({ error: "Could not create question." }, { status: 500 });
  return NextResponse.json({ question }, { status: 201 });
}
