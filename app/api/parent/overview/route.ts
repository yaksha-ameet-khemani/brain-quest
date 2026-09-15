import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireParent } from "@/lib/requireParent";
import { getBalance } from "@/lib/balance";
import type { ChildRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
}

// The actual point of a parent dashboard isn't "how many points does each
// kid have" (the kid screen already shows that) - it's "which categories is
// each kid weak in", so you know what to nudge them toward. This endpoint
// does that aggregation. All parents (and admin) share the same pool of
// children - there's no per-parent filter here.
export async function GET() {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const children = await query<Pick<ChildRow, "id" | "name" | "avatar" | "level">>(
    "SELECT id, name, avatar, level FROM children ORDER BY created_at ASC"
  );

  const overview = await Promise.all(
    children.map(async (child) => {
      const balance = await getBalance(child.id);

      const rounds = await query<{ id: string; status: string }>(
        "SELECT id, status FROM rounds WHERE child_id = $1",
        [child.id]
      );
      const roundsPlayed = rounds.filter((r) => r.status === "completed").length;
      const roundIds = rounds.map((r) => r.id);

      const byCategory = new Map<string, CategoryStat>();
      if (roundIds.length > 0) {
        const answered = await query<{ category: string; is_correct: boolean }>(
          `SELECT category, is_correct FROM round_questions
           WHERE round_id = ANY($1::uuid[]) AND is_correct IS NOT NULL`,
          [roundIds]
        );
        for (const row of answered) {
          const entry = byCategory.get(row.category) ?? { category: row.category, correct: 0, total: 0 };
          entry.total++;
          if (row.is_correct) entry.correct++;
          byCategory.set(row.category, entry);
        }
      }

      return {
        child: { id: child.id, name: child.name, avatar: child.avatar, level: child.level },
        balance,
        roundsPlayed,
        categoryStats: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
      };
    })
  );

  return NextResponse.json({ overview });
}
