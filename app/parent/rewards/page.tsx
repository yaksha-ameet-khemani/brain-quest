import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/requireParent";
import RewardCatalog from "@/components/RewardCatalog";

export const dynamic = "force-dynamic";

export default async function RewardsCatalogPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/parent");

  return <RewardCatalog />;
}
