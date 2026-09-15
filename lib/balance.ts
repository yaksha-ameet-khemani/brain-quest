import "server-only";
import { queryOne } from "@/lib/db";

/** A child's point balance is always derived from the ledger, never stored
 * directly - see docs/blueprint.md "points ledger, not a mutable column". */
export async function getBalance(childId: string): Promise<number> {
  const row = await queryOne<{ sum: string | null }>(
    "SELECT COALESCE(SUM(amount), 0) AS sum FROM point_transactions WHERE child_id = $1",
    [childId]
  );
  return Number(row?.sum ?? 0);
}
