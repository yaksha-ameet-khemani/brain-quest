import { redirect } from "next/navigation";
import { requireParent } from "@/lib/requireParent";
import ChildLog from "@/components/ChildLog";

export const dynamic = "force-dynamic";

export default async function ChildLogPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const parent = await requireParent();
  if (!parent) redirect("/login/parent");

  return <ChildLog childId={childId} />;
}
