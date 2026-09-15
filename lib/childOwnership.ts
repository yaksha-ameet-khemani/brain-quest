import "server-only";
import { queryOne } from "@/lib/db";
import type { ChildRow, ParentRole } from "@/lib/types";

/** Admin can manage any child; a parent only their own. Returns the child
 * row on success, or null if not found/not owned (caller decides the exact
 * 403 vs 404 message it wants). */
export async function ownedChild(
  childId: string,
  parent: { id: string; role: ParentRole }
): Promise<Pick<ChildRow, "id" | "parent_id"> | null> {
  const child = await queryOne<Pick<ChildRow, "id" | "parent_id">>(
    "SELECT id, parent_id FROM children WHERE id = $1",
    [childId]
  );
  if (!child) return null;
  if (parent.role !== "admin" && child.parent_id !== parent.id) return null;
  return child;
}
