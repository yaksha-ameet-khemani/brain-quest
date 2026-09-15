import "server-only";
import { cookies } from "next/headers";
import { PARENT_COOKIE_NAME, verifyParentSessionToken } from "@/lib/parentSession";
import { queryOne } from "@/lib/db";
import type { ParentRow } from "@/lib/types";

/** Returns the signed-in parent's { id, email }, or null. Re-checks the
 * parent still exists in the DB (cheap, and means a deleted account's
 * cookie stops working immediately rather than at expiry). */
export async function requireParent(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_COOKIE_NAME)?.value;
  const session = verifyParentSessionToken(token);
  if (!session) return null;

  const parent = await queryOne<Pick<ParentRow, "id" | "email">>(
    "SELECT id, email FROM parents WHERE id = $1",
    [session.parentId]
  );
  if (!parent) return null;
  return parent;
}
