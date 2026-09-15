import "server-only";
import { cookies } from "next/headers";
import { PARENT_COOKIE_NAME, verifyParentSessionToken } from "@/lib/parentSession";
import { queryOne } from "@/lib/db";
import type { ParentRow, ParentRole } from "@/lib/types";

/** Returns the signed-in parent's { id, email, role }, or null. Re-checks the
 * parent still exists in the DB (cheap, and means a deleted account's
 * cookie stops working immediately rather than at expiry). Works for both
 * roles - use requireAdmin() instead when an action is admin-only. */
export async function requireParent(): Promise<{ id: string; email: string; role: ParentRole } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_COOKIE_NAME)?.value;
  const session = verifyParentSessionToken(token);
  if (!session) return null;

  const parent = await queryOne<Pick<ParentRow, "id" | "email" | "role">>(
    "SELECT id, email, role FROM parents WHERE id = $1",
    [session.parentId]
  );
  if (!parent) return null;
  return parent;
}

/** Same as requireParent(), but returns null unless the signed-in account is
 * the admin. Use for admin-only actions (creating/deleting parent accounts). */
export async function requireAdmin(): Promise<{ id: string; email: string; role: ParentRole } | null> {
  const parent = await requireParent();
  if (!parent || parent.role !== "admin") return null;
  return parent;
}
