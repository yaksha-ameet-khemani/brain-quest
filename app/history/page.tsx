import { redirect } from "next/navigation";
import Link from "next/link";
import { requireKid } from "@/lib/requireKid";
import PointsHistory from "@/components/PointsHistory";

export const dynamic = "force-dynamic";

// A kid's own 30-day history (points, logins, reward requests). Only ever
// shows the signed-in child - /api/history reads the id from the session.
export default async function HistoryPage() {
  const kid = await requireKid();
  if (!kid) redirect("/");

  return (
    <main className="flex flex-col gap-6 pt-6">
      <Link href="/dashboard" className="text-sm text-slate-500">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">📅 My points history</h1>
      <PointsHistory endpoint="/api/history" forKid />
    </main>
  );
}
