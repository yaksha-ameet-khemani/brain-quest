import { redirect } from "next/navigation";
import { requireParent } from "@/lib/requireParent";
import ChildLog from "@/components/ChildLog";

export const dynamic = "force-dynamic";

export default async function ChildLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { childId } = await params;
  const { tab } = await searchParams;
  const parent = await requireParent();
  if (!parent) redirect("/login/parent");

  return <ChildLog childId={childId} isAdmin={parent.role === "admin"} initialTab={tab} />;
}
