import "server-only";

// The one function every route MUST use before sending a question to the
// browser. correct_index and explanation stay server-side until the kid has
// actually answered that question.
export function sanitizeQuestion(row: {
  position: number;
  category: string;
  question_text: string;
  options: unknown;
  shown_at: string | null;
}) {
  return {
    position: row.position,
    category: row.category,
    questionText: row.question_text,
    options: row.options as string[],
    shownAt: row.shown_at,
  };
}
