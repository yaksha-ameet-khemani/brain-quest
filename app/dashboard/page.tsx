import { redirect } from "next/navigation";
import Link from "next/link";
import { requireKid } from "@/lib/requireKid";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getBalance } from "@/lib/balance";
import { LEVELS, MAX_ROUNDS_PER_DAY, type Level } from "@/lib/config";
import { todayRangeUtc } from "@/lib/timezone";
import KidLogoutButton from "@/components/KidLogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const kid = await requireKid();
  if (!kid) redirect("/");

  const db = supabaseAdmin();
  const { data: child } = await db
    .from("children")
    .select("id, name, avatar, level")
    .eq("id", kid.childId)
    .single();
  if (!child) redirect("/");

  const balance = await getBalance(kid.childId);
  const level = child.level as Level;

  const { start, end } = todayRangeUtc();
  const { count } = await db
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("child_id", kid.childId)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString());
  const roundsLeft = Math.max(0, MAX_ROUNDS_PER_DAY - (count ?? 0));

  return (
    <main className="flex flex-col gap-8 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{child.avatar}</span>
          <div>
            <h1 className="text-xl font-bold">{child.name}</h1>
            <p className="text-sm text-slate-500">{LEVELS[level].label}</p>
          </div>
        </div>
        <KidLogoutButton />
      </header>

      <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
        <p className="text-sm font-medium text-slate-500">Your points</p>
        <p className="text-5xl font-extrabold text-brand-600">{balance}</p>
      </section>

      <section className="grid gap-4">
        {roundsLeft > 0 ? (
          <Link
            href="/quiz"
            className="rounded-2xl bg-brand-500 p-6 text-center text-lg font-bold text-white shadow-sm active:bg-brand-600"
          >
            🎯 Start a quiz round ({roundsLeft} left today)
          </Link>
        ) : (
          <div className="rounded-2xl bg-slate-100 p-6 text-center text-slate-500">
            You&apos;ve played all your rounds for today - come back tomorrow! 🌙
          </div>
        )}

        <Link
          href="/rewards"
          className="rounded-2xl bg-white p-6 text-center text-lg font-bold text-brand-700 shadow-sm ring-1 ring-slate-100 active:bg-brand-50"
        >
          🎁 Rewards catalog
        </Link>
      </section>
    </main>
  );
}
