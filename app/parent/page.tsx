import { redirect } from "next/navigation";
import { requireParent } from "@/lib/supabaseServerAuth";
import ParentDashboard from "@/components/ParentDashboard";

export const dynamic = "force-dynamic";

export default async function ParentPage() {
  const parent = await requireParent();
  if (!parent) redirect("/login/parent");

  return <ParentDashboard parentEmail={parent.email ?? ""} />;
}
