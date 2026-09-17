"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  accuracy: number | null;
}
interface TrendStat {
  category: string;
  recentAccuracy: number | null;
  priorAccuracy: number | null;
  recentAttempts: number;
  priorAttempts: number;
  direction: "up" | "down" | "flat" | "insufficient-data";
}
interface WeakSpot {
  kind: "concept" | "math-skill";
  label: string;
  category: string;
  accuracy: number;
  attempts: number;
}
interface LevelReadiness {
  atTopLevel: boolean;
  daysConsidered: number;
  bonusUnlockedDays: number;
  ready: boolean;
  note: string | null;
}
interface ChildReportData {
  summary: string;
  hasEnoughData: boolean;
  snapshot: {
    questionsAnswered: number;
    roundsCompleted: number;
    overallAccuracy: number | null;
    avgSecondsPerQuestion: number | null;
    currentDailyStreak: number;
    currentWeeklyStreak: number;
  };
  categoryBreakdown: CategoryStat[];
  trend: TrendStat[];
  weakSpots: WeakSpot[];
  pendingRecheckCount: number;
  levelReadiness: LevelReadiness;
}

const CATEGORY_LABEL: Record<string, string> = {
  math: "🔢 Math",
  logic: "🧩 Logic",
  riddle: "❓ Riddle",
  spatial: "📐 Spatial",
};

const TREND_BADGE: Record<TrendStat["direction"], { label: string; className: string }> = {
  up: { label: "↑ improving", className: "bg-emerald-100 text-emerald-700" },
  down: { label: "↓ slipping", className: "bg-rose-100 text-rose-600" },
  flat: { label: "→ steady", className: "bg-slate-100 text-slate-600" },
  "insufficient-data": { label: "not enough data yet", className: "bg-slate-100 text-slate-400" },
};

function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export default function ChildReport({ childId }: { childId: string }) {
  const [report, setReport] = useState<ChildReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/parent/children/${childId}/report`);
      if (res.ok) setReport((await res.json()).report);
      setLoading(false);
    })();
  }, [childId]);

  if (loading) return <p className="py-6 text-center text-sm text-slate-500">Loading report…</p>;
  if (!report) return <p className="py-6 text-center text-sm text-slate-500">Could not load report.</p>;

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-900 ring-1 ring-brand-100">
        {report.summary}
      </section>

      {report.hasEnoughData && (
        <>
          <section className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-lg font-bold">{pct(report.snapshot.overallAccuracy)}</p>
              <p className="text-slate-500">Overall accuracy</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-lg font-bold">{report.snapshot.questionsAnswered}</p>
              <p className="text-slate-500">Questions answered</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-lg font-bold">
                {report.snapshot.avgSecondsPerQuestion !== null
                  ? formatDuration(Math.round(report.snapshot.avgSecondsPerQuestion))
                  : "—"}
              </p>
              <p className="text-slate-500">Avg. time/question</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-lg font-bold">
                {report.snapshot.currentDailyStreak > 0 ? `🔥 ${report.snapshot.currentDailyStreak}d` : "—"}
              </p>
              <p className="text-slate-500">Daily streak</p>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h3 className="mb-3 text-sm font-bold">Strengths &amp; weaknesses (last 30 days)</h3>
            <div className="grid gap-2">
              {report.categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-400"
                      style={{ width: `${Math.round((c.accuracy ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-slate-500">
                    {pct(c.accuracy)} ({c.correct}/{c.total})
                  </span>
                </div>
              ))}
              {report.categoryBreakdown.length === 0 && (
                <p className="text-xs text-slate-400">No rounds in the last 30 days.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h3 className="mb-3 text-sm font-bold">Trend (last 14 days vs. the 14 before that)</h3>
            <div className="grid gap-2">
              {report.trend.map((t) => {
                const badge = TREND_BADGE[t.direction];
                return (
                  <div key={t.category} className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span>{CATEGORY_LABEL[t.category] ?? t.category}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400">
                        {pct(t.priorAccuracy)} → {pct(t.recentAccuracy)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${badge.className}`}>{badge.label}</span>
                    </span>
                  </div>
                );
              })}
              {report.trend.length === 0 && <p className="text-xs text-slate-400">Not enough recent activity yet.</p>}
            </div>
          </section>

          {report.weakSpots.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <h3 className="mb-2 text-sm font-bold text-amber-800">🎯 Specific things to work on</h3>
              <ul className="grid gap-1 text-xs text-amber-800">
                {report.weakSpots.map((w) => (
                  <li key={`${w.kind}-${w.label}`}>
                    <span className="font-semibold capitalize">{w.label}</span>{" "}
                    <span className="text-amber-700">({CATEGORY_LABEL[w.category] ?? w.category})</span> -{" "}
                    {pct(w.accuracy)} correct over {w.attempts} tries
                  </li>
                ))}
              </ul>
              {report.pendingRecheckCount > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  {report.pendingRecheckCount} of these are already queued for the next daily checkup.
                </p>
              )}
            </section>
          )}

          {report.levelReadiness.note && (
            <section className="rounded-2xl bg-sky-50 p-4 text-xs text-sky-700 ring-1 ring-sky-200">
              🌟 {report.levelReadiness.note}
            </section>
          )}
        </>
      )}
    </div>
  );
}
