import { redirect } from "next/navigation";
import Link from "next/link";
import { requireKid } from "@/lib/requireKid";
import { queryOne } from "@/lib/db";
import { getBalance } from "@/lib/balance";
import { getLevelProgress } from "@/lib/levelProgress";
import { LEVELS, MAX_ROUNDS_PER_DAY, type Level } from "@/lib/config";
import type { ChildRow } from "@/lib/types";
import KidLogoutButton from "@/components/KidLogoutButton";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const kid = await requireKid();
  if (!kid) redirect("/");

  const child = await queryOne<Pick<ChildRow, "id" | "name" | "avatar" | "photo_data_url" | "level">>(
    "SELECT id, name, avatar, photo_data_url, level FROM children WHERE id = $1",
    [kid.childId]
  );
  if (!child) redirect("/");

  const balance = await getBalance(kid.childId);
  const level = child.level as Level;
  const progress = await getLevelProgress(kid.childId, level);
  const baseRoundsLeft = Math.max(0, MAX_ROUNDS_PER_DAY - progress.baseRoundsToday);

  return (
    <main className="flex flex-col gap-8 pt-6">
      <AutoRefresh />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center text-4xl">
            <Avatar photoDataUrl={child.photo_data_url} avatar={child.avatar} name={child.name} />
          </span>
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
        {baseRoundsLeft > 0 ? (
          <Link
            href="/quiz"
            className="rounded-2xl bg-brand-500 p-6 text-center text-lg font-bold text-white shadow-sm active:bg-brand-600"
          >
            🎯 Start a quiz round ({baseRoundsLeft} left today)
          </Link>
        ) : (
          <div className="rounded-2xl bg-slate-100 p-6 text-center text-slate-500">
            You&apos;ve finished today&apos;s {LEVELS[level].label} rounds! 🌙
          </div>
        )}

        {progress.bonusLevel && (
          <BonusRoundCard progress={progress} bonusLevel={progress.bonusLevel} />
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

function BonusRoundCard({
  progress,
  bonusLevel,
}: {
  progress: Awaited<ReturnType<typeof getLevelProgress>>;
  bonusLevel: Level;
}) {
  if (progress.bonusUnlockedToday && progress.bonusRoundsRemaining > 0) {
    return (
      <Link
        href={`/quiz?level=${bonusLevel}`}
        className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-center text-lg font-bold text-white shadow-sm active:opacity-90"
      >
        🌟 Bonus {LEVELS[bonusLevel].label} round! ({progress.bonusRoundsRemaining} left today)
      </Link>
    );
  }

  if (progress.bonusUnlockedToday) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-center text-sm font-medium text-amber-700 ring-1 ring-amber-200">
        🌟 You used up today&apos;s {LEVELS[bonusLevel].label} bonus rounds - amazing work!
      </div>
    );
  }

  const accuracyPct = progress.baseAccuracyToday !== null ? Math.round(progress.baseAccuracyToday * 100) : null;
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 ring-1 ring-slate-200">
      🔒 Finish all {progress.baseRoundsRequired} of today&apos;s rounds with over 75% correct to unlock a{" "}
      {LEVELS[bonusLevel].label} bonus round.
      <br />
      <span className="font-semibold text-slate-600">
        {progress.baseRoundsToday}/{progress.baseRoundsRequired} rounds done
        {accuracyPct !== null && ` · ${accuracyPct}% correct so far`}
      </span>
    </div>
  );
}
