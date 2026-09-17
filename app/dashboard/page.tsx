import { redirect } from "next/navigation";
import Link from "next/link";
import { requireKid } from "@/lib/requireKid";
import { queryOne } from "@/lib/db";
import { getBalance } from "@/lib/balance";
import { getLevelProgress } from "@/lib/levelProgress";
import { getReviewProgress } from "@/lib/reviewProgress";
import { getCheckupProgress } from "@/lib/checkupProgress";
import { getStreaks } from "@/lib/streak";
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
  const reviewProgress = await getReviewProgress(kid.childId);
  const checkupProgress = await getCheckupProgress(kid.childId);
  const streaks = await getStreaks(kid.childId);

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
        {(streaks.currentDailyStreak > 0 || streaks.currentWeeklyStreak > 0) && (
          <p className="mt-2 text-sm font-semibold text-orange-600">
            {streaks.currentDailyStreak > 0 && `🔥 ${streaks.currentDailyStreak} day streak`}
            {streaks.currentDailyStreak > 0 && streaks.currentWeeklyStreak > 0 && " · "}
            {streaks.currentWeeklyStreak > 0 && `🗓️ ${streaks.currentWeeklyStreak} week streak`}
          </p>
        )}
      </section>

      <section className="grid gap-4">
        {checkupProgress.checkupAvailableToday && (
          <p className="rounded-2xl bg-violet-50 px-4 py-3 text-center text-sm font-medium text-violet-700 ring-1 ring-violet-200">
            🧠 Before today&apos;s round: a quick checkup on {checkupProgress.pendingCount} thing
            {checkupProgress.pendingCount === 1 ? "" : "s"} you missed last time - similar questions, not the same
            ones, so we can see it really clicked.
          </p>
        )}

        {baseRoundsLeft > 0 ? (
          <Link
            href="/quiz"
            className="rounded-2xl bg-brand-500 p-6 text-center text-lg font-bold text-white shadow-sm active:bg-brand-600"
          >
            {checkupProgress.checkupAvailableToday
              ? "🧠 Start today's checkup"
              : `🎯 Start a quiz round (${baseRoundsLeft} left today)`}
          </Link>
        ) : (
          <div className="rounded-2xl bg-slate-100 p-6 text-center text-slate-500">
            You&apos;ve finished today&apos;s {LEVELS[level].label} rounds! 🌙
          </div>
        )}

        {progress.bonusLevel && (
          <BonusRoundCard progress={progress} bonusLevel={progress.bonusLevel} />
        )}

        {reviewProgress.wrongQuestionCount > 0 && <ReviewRoundCard progress={reviewProgress} />}

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

function ReviewRoundCard({ progress }: { progress: Awaited<ReturnType<typeof getReviewProgress>> }) {
  if (progress.reviewAvailableToday) {
    return (
      <Link
        href="/quiz?mode=review"
        className="rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 p-6 text-center text-lg font-bold text-white shadow-sm active:opacity-90"
      >
        🔁 Review {progress.wrongQuestionCount} tricky question{progress.wrongQuestionCount === 1 ? "" : "s"}{" "}
        (no points, just practice)
      </Link>
    );
  }

  return (
    <div className="rounded-2xl bg-sky-50 p-4 text-center text-sm font-medium text-sky-700 ring-1 ring-sky-200">
      🔁 You&apos;ve used today&apos;s review round - come back tomorrow to try those {progress.wrongQuestionCount}{" "}
      again.
    </div>
  );
}
