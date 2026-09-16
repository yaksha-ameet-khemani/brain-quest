import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/requireParent";
import QuestionBank from "@/components/QuestionBank";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/parent");

  return <QuestionBank />;
}
