import "server-only";
import { supabaseAdmin } from "@/lib/supabaseServer";

/** A child's point balance is always derived from the ledger, never stored
 * directly - see docs/blueprint.md "points ledger, not a mutable column". */
export async function getBalance(childId: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("point_transactions")
    .select("amount")
    .eq("child_id", childId);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}
