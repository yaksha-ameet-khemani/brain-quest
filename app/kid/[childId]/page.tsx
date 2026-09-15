import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import PinEntry from "@/components/PinEntry";

export const dynamic = "force-dynamic";

export default async function KidLoginPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { data: child } = await supabaseAdmin()
    .from("children")
    .select("id, name, avatar")
    .eq("id", childId)
    .single();

  if (!child) notFound();

  return <PinEntry childId={child.id} name={child.name} avatar={child.avatar} />;
}
