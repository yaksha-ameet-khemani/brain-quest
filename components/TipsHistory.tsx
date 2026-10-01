"use client";

import { useEffect, useState } from "react";

interface Tip {
  title: string;
  text: string;
}
interface TipExample {
  question: string;
  picked: string | null;
  correct: string;
  seconds: number | null;
  practice: boolean;
}
interface SkillTip {
  skill: string;
  skillName: string;
  wrongCount: number;
  examples: TipExample[];
  tip: Tip;
  shownToChild: boolean;
}
interface HabitTip {
  kind: "rushing" | "timeouts";
  count: number;
  tip: Tip;
  shownToChild: boolean;
}
interface TipSet {
  periodStart: string;
  periodEnd: string;
  answered: number;
  wrong: number;
  status: "no_answers" | "no_wrong" | "tips";
  childTips: Tip[];
  skillTips: SkillTip[];
  habit: HabitTip | null;
}

function shortDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const HABIT_REASON: Record<HabitTip["kind"], (n: number) => string> = {
  rushing: (n) => `${n} wrong answer${n === 1 ? "" : "s"} given in under 8 seconds - likely rushing.`,
  timeouts: (n) => `Time ran out on ${n} question${n === 1 ? "" : "s"}.`,
};

/** Every saved 3-day tip set for a child, newest first (lib/tips.ts), for
 * the child's parent and the admin: the tips, why each was chosen, and the
 * actual mistakes behind it. The child only ever sees the tip text. */
export default function TipsHistory({ childId }: { childId: string }) {
  const [tips, setTips] = useState<TipSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/parent/children/${childId}/tips`);
      if (res.ok) setTips((await res.json()).tips);
      else setError("Could not load tips.");
    })();
  }, [childId]);

  if (tips === null) return <p className="text-sm text-slate-500">{error ?? "Loading…"}</p>;

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        Every 3 days, this child&apos;s wrong answers (practice included) are turned into tips. The child sees only the
        tips marked &quot;shown to child&quot;, worded to encourage - no scores. You also see why each tip was chosen.
        Tips are saved permanently and are kept separate from the reports.
      </p>
      {tips.length === 0 && <p className="text-sm text-slate-500">No finished 3-day period yet.</p>}

      {tips.map((set, i) => (
        <div key={set.periodStart} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">
              💡 {shortDate(set.periodStart)} - {shortDate(set.periodEnd)}
              {i === 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  showing now
                </span>
              )}
            </h2>
            <span className="text-xs text-slate-500">
              {set.answered} answered · {set.wrong} wrong
            </span>
          </div>

          {set.status === "no_answers" && <p className="mt-2 text-sm text-slate-500">No answers in these 3 days.</p>}
          {set.status === "no_wrong" && (
            <p className="mt-2 text-sm text-emerald-700">No wrong answers - the child was told &quot;Brilliant, keep it up&quot;.</p>
          )}

          {set.skillTips.map((st) => (
            <div key={st.skill} className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold">
                {st.skillName}: {st.wrongCount} wrong
                {st.shownToChild && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    shown to child
                  </span>
                )}
              </p>
              <ul className="mt-1.5 grid gap-1 text-xs text-slate-600">
                {st.examples.map((ex, j) => (
                  <li key={j}>
                    • {ex.question.replace(/\n/g, " ")}{" "}
                    <span className="whitespace-nowrap">
                      → picked <span className="font-semibold text-rose-600">{ex.picked ?? "nothing (time ran out)"}</span>,
                      correct <span className="font-semibold text-emerald-700">{ex.correct}</span>
                      {ex.seconds !== null && ` · ${ex.seconds}s`}
                      {ex.practice && " · practice"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm">
                <span className="font-semibold">Tip - {st.tip.title}:</span> {st.tip.text}
              </p>
            </div>
          ))}

          {set.habit && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold">
                Habit: {HABIT_REASON[set.habit.kind](set.habit.count)}
                {set.habit.shownToChild && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    shown to child
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-semibold">Tip - {set.habit.tip.title}:</span> {set.habit.tip.text}
              </p>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
