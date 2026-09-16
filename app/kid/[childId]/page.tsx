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

  return <PinEntry childId={child.id} name={child.name} avatar={child.avatar} photoDataUrl={child.photo_data_url} />;
}
