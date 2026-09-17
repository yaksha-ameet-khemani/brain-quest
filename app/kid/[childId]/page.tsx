import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import type { ChildRow } from "@/lib/types";
import PinEntry from "@/components/PinEntry";

export const dynamic = "force-dynamic";

export default async function KidLoginPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "photo_data_url">>(
    "SELECT id, name, avatar, photo_data_url FROM children WHERE id = $1",
    [childId]
  );

  if (!child) notFound();

  // Only this one child's last-login, shown after picking their own avatar -
  // not a side-by-side grid of every kid's activity on the homepage (see
  // docs/blueprint.md v8 for why that was deliberately removed).
  const lastLogin = await queryOne<{ logged_in_at: string }>(
    "SELECT logged_in_at FROM child_logins WHERE child_id = $1 ORDER BY logged_in_at DESC LIMIT 1",
    [childId]
  );

  return (
    <PinEntry
      childId={child.id}
      name={child.name}
      avatar={child.avatar}
      photoDataUrl={child.photo_data_url}
      lastLoginAt={lastLogin?.logged_in_at ?? null}
    />
  );
}
