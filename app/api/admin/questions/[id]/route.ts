import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/requireParent";
import { BANK_CATEGORIES, isValidLevel, type BankCategory, type Level } from "@/lib/config";
import type { QuestionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH: edit a question's content, or toggle isActive (archive/restore).
// Admin-only. There's no hard DELETE - a question that's ever been served
// is referenced by round_questions (a child's permanent answer history), so
// "remove from rotation" is what is_active = false means, not erase.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (isValidLevel(body?.level)) {
    sets.push(`level = $${i++}`);
    values.push(body.level as Level);
  }
  if (typeof body?.category === "string" && BANK_CATEGORIES.includes(body.category as BankCategory)) {
    sets.push(`category = $${i++}`);
    values.push(body.category);
  }
  if (typeof body?.questionText === "string" && body.questionText.trim()) {
    sets.push(`question_text = $${i++}`);
    values.push(body.questionText.trim());
  }
  if (
    Array.isArray(body?.options) &&
    body.options.length === 4 &&
    body.options.every((o: unknown) => typeof o === "string" && o.trim())
  ) {
    sets.push(`options = $${i++}`);
    values.push(JSON.stringify(body.options));
  }
  if (typeof body?.correctOptionIndex === "number" && body.correctOptionIndex >= 0 && body.correctOptionIndex <= 3) {
    sets.push(`correct_option_index = $${i++}`);
    values.push(body.correctOptionIndex);
  }
  if (typeof body?.explanation === "string" && body.explanation.trim()) {
    sets.push(`explanation = $${i++}`);
    values.push(body.explanation.trim());
  }
  if (typeof body?.isActive === "boolean") {
    sets.push(`is_active = $${i++}`);
    values.push(body.isActive);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(id);
  const question = await queryOne<QuestionRow>(
    `UPDATE questions SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!question) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ question });
}
