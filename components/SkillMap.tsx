"use client";

import { useEffect, useState } from "react";
import {
  RUSHED_ANSWER_SECONDS,
  SKILL_MASTERED_DISTINCT,
  SKILL_MASTERED_PCT,
  SKILL_MIN_ANSWERS,
  SKILL_RECENT_ANSWERS,
  SKILL_SOLID_PCT,
  SKILL_THIN_BANK,
} from "@/lib/config";
import { SKILL_AREAS } from "@/lib/skills";
import type { SkillRow, SkillState } from "@/lib/skillMap";

const STATE: Record<SkillState, { label: string; className: string; help: string }> = {
  mastered: {
    label: "Mastered",
    className: "bg-emerald-600 text-white",
    help: `${SKILL_MASTERED_PCT}%+ of the last ${SKILL_RECENT_ANSWERS} right, on at least ${SKILL_MASTERED_DISTINCT} different questions`,
  },
  solid: { label: "Solid", className: "bg-emerald-100 text-emerald-800", help: `${SKILL_SOLID_PCT}%+ of the last ${SKILL_RECENT_ANSWERS} right` },
  learning: { label: "Learning", className: "bg-amber-100 text-amber-800", help: `under ${SKILL_SOLID_PCT}% of the last ${SKILL_RECENT_ANSWERS} right` },
  guessing: {
    label: "Guessing",
    className: "bg-rose-100 text-rose-800",
    help: `under ${SKILL_SOLID_PCT}% right, and most recent wrong answers came in under ${RUSHED_ANSWER_SECONDS}s`,
  },
  too_few: { label: "Too few", className: "bg-slate-100 text-slate-600", help: `fewer than ${SKILL_MIN_ANSWERS} answers - not judged yet` },
  not_seen: { label: "Not seen", className: "bg-white text-slate-400 ring-1 ring-slate-200", help: "no answers" },
};

const STATE_ORDER: SkillState[] = ["mastered", "solid", "learning", "guessing", "too_few", "not_seen"];

function shortDate(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** The skill table, grouped by area. Shared by the Skills tab and the 10-day reports. */
export function SkillTable({ rows, level }: { rows: SkillRow[]; level: number }) {
  const counts = STATE_ORDER.map((s) => [s, rows.filter((r) => r.state === s).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {counts.map(([s, n]) => (
          <span key={s} className={`rounded-full px-2.5 py-0.5 font-semibold ${STATE[s].className}`}>
            {STATE[s].label} {n}
          </span>
        ))}
      </div>

      {SKILL_AREAS.map((area) => {
        const inArea = rows.filter((r) => r.area === area.key);
        const seen = inArea.filter((r) => r.state !== "not_seen");
        const unseen = inArea.filter((r) => r.state === "not_seen");
        return (
          <div key={area.key}>
            <h4 className="mb-1 text-sm font-bold">{area.name}</h4>
            {seen.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-1.5 pr-2 font-semibold">Skill</th>
                      <th className="py-1.5 pr-2 font-semibold">State</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Last {SKILL_RECENT_ANSWERS}</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">All</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Rushed wrong</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Timed out</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Paused</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Median s</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Last seen</th>
                      <th className="py-1.5 pr-2 text-right font-semibold">Bank L{level}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seen.map((r) => (
                      <tr key={r.key} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2 font-medium">{r.name}</td>
                        <td className="py-1.5 pr-2">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${STATE[r.state].className}`}>
                            {STATE[r.state].label}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          {r.recentCorrect}/{r.recentAnswered}
                        </td>
                        <td className="py-1.5 pr-2 text-right text-slate-500">
                          {r.correct}/{r.answered}
                        </td>
                        <td className="py-1.5 pr-2 text-right">{r.rushedWrong || "–"}</td>
                        <td className="py-1.5 pr-2 text-right">{r.timedOut || "–"}</td>
                        <td className="py-1.5 pr-2 text-right">{r.paused || "–"}</td>
                        <td className="py-1.5 pr-2 text-right">{r.medianSeconds ?? "–"}</td>
                        <td className="whitespace-nowrap py-1.5 pr-2 text-right">{r.lastAnswered ? shortDate(r.lastAnswered) : "–"}</td>
                        <td className={`whitespace-nowrap py-1.5 pr-2 text-right ${r.thin ? "font-bold text-rose-700" : ""}`}>
                          {r.thin && "⚠️ "}
                          {r.bankAtLevel}
                          {r.generated && " + math"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {unseen.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Not seen yet: {unseen.map((r) => `${r.name} (${r.bankAtLevel}${r.generated ? " + math" : ""} at L${level})`).join(", ")}
              </p>
            )}
          </div>
        );
      })}

      <ul className="grid gap-0.5 text-xs text-slate-500">
        {STATE_ORDER.map((s) => (
          <li key={s}>
            <b>{STATE[s].label}</b>: {STATE[s].help}.
          </li>
        ))}
        <li>
          <b>Bank L{level}</b>: active bank questions with this skill at Level {level}; &quot;+ math&quot; means the math generator also
          makes them. ⚠️ = weak here and fewer than {SKILL_THIN_BANK} questions to practise with.
        </li>
      </ul>
    </div>
  );
}

/** Admin-only live skill map for one child. */
export default function SkillMap({ childId }: { childId: string }) {
  const [data, setData] = useState<{ level: number; windowDays: number; rows: SkillRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/skills`);
      if (res.ok) setData(await res.json());
      else setError("Couldn't load the skill map.");
    })();
  }, [childId]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">🧩 Skill map</h2>
      <p className="mt-1 text-xs text-slate-500">
        Every answer from the last {data?.windowDays ?? "…"} days, sorted into the skill it tests (bank questions by their skill tag,
        math by the kind of question). Only admin can see this.
      </p>
      <div className="mt-3">
        {error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : data === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <SkillTable rows={data.rows} level={data.level} />
        )}
      </div>
    </section>
  );
}
