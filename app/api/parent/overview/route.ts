import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireParent } from "@/lib/supabaseServerAuth";
import { getBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
}

// The actual point of a parent dashboard isn't "how many points does each
// kid have" (the kid screen already shows that) - it's "which categories is
// each kid weak in", so you know what to nudge them toward. This endpoint
// does that aggregation.
export async function GET() {
  const parent = await requireParent();
  if (!parent) return NextResponse.json({ error: "Parent sign-in required." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: children, error } = await db
    .from("children")
    .select("id, name, avatar, level")
    .eq("parent_id", parent.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const overview = await Promise.all(
    (children ?? []).map(async (child) => {
      const balance = await getBalance(child.id);

      const { data: roundsData } = await db
        .from("rounds")
        .select("id, status")
        .eq("child_id", child.id);
      const roundsPlayed = (roundsData ?? []).filter((r) => r.status === "completed").length;
      const roundIds = (roundsData ?? []).map((r) => r.id);

      const byCategory = new Map<string, CategoryStat>();
      const answered =
        roundIds.length > 0
          ? (
              await db
                .from("round_questions")
                .select("category, is_correct")
                .in("round_id", roundIds)
                .not("is_correct", "is", null)
            ).data
          : [];
      for (const row of answered ?? []) {
        const cat = row.category as string;
        const entry = byCategory.get(cat) ?? { category: cat, correct: 0, total: 0 };
        entry.total++;
        if (row.is_correct) entry.correct++;
        byCategory.set(cat, entry);
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
