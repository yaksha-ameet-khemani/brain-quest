import "server-only";
import { query, withTransaction } from "@/lib/db";
import { CATEGORIES, DEFAULT_CATEGORY_WEIGHT, type Category } from "@/lib/config";
import type { ChildCategoryWeightRow } from "@/lib/types";

export type CategoryWeights = Record<Category, number>;

function defaults(): CategoryWeights {
  return { math: DEFAULT_CATEGORY_WEIGHT, logic: DEFAULT_CATEGORY_WEIGHT, riddle: DEFAULT_CATEGORY_WEIGHT, spatial: DEFAULT_CATEGORY_WEIGHT };
}

/** A category with no row for this child uses the default weight (equal
 * odds) - admin only needs to set the categories they actually want to
 * change. */
export async function getCategoryWeights(childId: string): Promise<CategoryWeights> {
  const rows = await query<ChildCategoryWeightRow>(
    "SELECT category, weight FROM child_category_weights WHERE child_id = $1",
    [childId]
  );
  const weights = defaults();
  for (const row of rows) weights[row.category] = row.weight;
  return weights;
}

/** Replaces all four category weights for a child in one go (upsert each,
 * delete any not present so removing a category resets it to default). */
export async function setCategoryWeights(childId: string, weights: Partial<CategoryWeights>): Promise<void> {
  await withTransaction(async (tx) => {
    for (const category of CATEGORIES) {
      const weight = weights[category];
      if (weight === undefined) continue;
      await tx.query(
        `INSERT INTO child_category_weights (child_id, category, weight)
         VALUES ($1, $2, $3)
         ON CONFLICT (child_id, category) DO UPDATE SET weight = EXCLUDED.weight`,
        [childId, category, weight]
      );
    }
  });
}

/** Weighted pick of `count` categories (with replacement) - a category can
 * be picked more than once, which is exactly the point: weight it higher to
 * see it more often in that child's rounds. Categories with weight 0 are
 * never picked unless every category is 0 (falls back to equal odds rather
 * than looping forever or crashing). */
export function pickWeightedCategories(weights: CategoryWeights, count: number): Category[] {
  const entries = CATEGORIES.map((c) => [c, weights[c]] as const);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  const pool = totalWeight > 0 ? entries : CATEGORIES.map((c) => [c, 1] as const);
  const total = totalWeight > 0 ? totalWeight : CATEGORIES.length;

  const picks: Category[] = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    let chosen: Category = pool[0]![0];
    for (const [category, weight] of pool) {
      if (r < weight) {
        chosen = category;
        break;
      }
      r -= weight;
    }
    picks.push(chosen);
  }
  return picks;
}
