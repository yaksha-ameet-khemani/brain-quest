"use client";

import { useEffect, useState } from "react";
import { RUSHED_ANSWER_SECONDS } from "@/lib/config";
import type { PeriodReport, SavedReportSummary, Tally } from "@/lib/periodReport";

const CATEGORY_LABEL: Record<string, string> = {
  math: "➗ Math",
  logic: "🧠 Logic",
  riddle: "🎭 Riddle",
  spatial: "🔷 Spatial",
};

function pct(t: Tally): string {
  return t.answered ? `${Math.round((100 * t.correct) / t.answered)}%` : "–";
}

function shortDate(key: string, withWeekday = false): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
  });
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr className="border-b border-slate-200">
            {head.map((h, i) => (
              <th key={h} className={`whitespace-nowrap py-2 pr-2 font-semibold ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">
              {r.map((c, j) => (
                <td key={j} className={`whitespace-nowrap py-1.5 pr-2 ${j > 0 ? "text-right" : "font-medium"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h3 className="mb-2 font-bold">{title}</h3>
      {children}
    </section>
  );
}

function ReportView({ report }: { report: PeriodReport }) {
  const t = report.totals;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        {report.complete
          ? `Saved ${new Date(report.generatedAt).toLocaleString()} · child was Level ${report.childLevel}`
          : "Period still in progress - live figures, saved automatically once the period ends."}
      </p>

      <Card title="💡 Key findings">
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {report.insights.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      <section className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          [t.answered, "Answered"],
          [`${t.correct} (${pct(t)})`, "Correct"],
          [t.wrongPicked, "Wrong"],
          [t.timedOut, "Timed out"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
            <p className="text-base font-bold">{v}</p>
            <p className="text-slate-500">{l}</p>
          </div>
        ))}
      </section>
      <p className="-mt-2 text-xs text-slate-500">
        {t.rounds} rounds on {t.daysPlayed} days · median {t.medianSeconds ?? "–"}s per answer · {t.reviewAnswered} were
        unscored review practice · {t.paused} paused
      </p>

      {report.categories.length > 0 && (
        <Card title="📚 By category">
          <Table
            head={["Category", "Answered", "Correct", "Wrong", "Timed out", "%", "By level", "First 5 → last 5 days", "Rushed wrong", "Median s"]}
            rows={report.categories.map((c) => [
              CATEGORY_LABEL[c.category] ?? c.category,
              c.answered,
              c.correct,
              c.wrongPicked,
              c.timedOut,
              pct(c),
              c.byLevel.map((l) => `L${l.level} ${pct(l)}`).join(" · "),
              `${pct(c.firstHalf)} → ${pct(c.secondHalf)}`,
              c.rushedWrong,
              c.medianSeconds ?? "–",
            ])}
          />
          <p className="mt-2 text-xs text-slate-500">&quot;Rushed wrong&quot; = a wrong pick made in under {RUSHED_ANSWER_SECONDS} seconds.</p>
        </Card>
      )}

      {report.mathSkills.length > 0 && (
        <Card title="➗ Math skills">
          <Table
            head={["Skill", "Answered", "Correct", "%"]}
            rows={report.mathSkills.map((s) => [s.label, s.answered, s.correct, pct(s)])}
          />
        </Card>
      )}

      <Card title="📅 Day by day">
        <Table
          head={["Day", "Logins", "Rounds", "Answered", "Correct", "Wrong", "%"]}
          rows={report.days.map((d) => [
            shortDate(d.date, true),
            d.logins || "–",
            d.rounds || "–",
            d.answered || "–",
            d.answered ? d.correct : "–",
            d.answered ? d.answered - d.correct : "–",
            pct(d),
          ])}
        />
      </Card>

      <Card title="⭐ Points & rewards">
        <p className="text-sm">
          Started with <b>{report.points.opening}</b> · earned <b className="text-emerald-700">+{report.points.earned}</b> ·
          spent <b className="text-rose-700">{report.points.spent}</b>
          {report.points.refunded + report.points.adjusted !== 0 && (
            <> · refunds/adjustments {report.points.refunded + report.points.adjusted}</>
          )}{" "}
          · ended with <b>{report.points.closing}</b>
        </p>
        {report.rewardRequests.length > 0 ? (
          <ul className="mt-2 grid gap-0.5 text-xs text-slate-600">
            {report.rewardRequests.map((r) => (
              <li key={r.requestedAt}>
                {new Date(r.requestedAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{" "}
                · {r.rewardName} ({r.cost}) · {r.status}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No reward requests in this period.</p>
        )}
      </Card>

      {report.missed.length > 0 && (
        <Card title="❌ Examples of questions missed">
          <p className="mb-2 text-xs text-slate-500">Most recent misses, up to 6 per category.</p>
          <ul className="grid gap-1.5 text-xs">
            {report.missed.map((m, i) => (
              <li key={i} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="font-semibold">{CATEGORY_LABEL[m.category]} · L{m.level}</span>
                {" · "}
                {m.timedOut ? "ran out of time" : m.seconds !== null ? `${m.seconds}s` : ""}
                <br />
                {m.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Admin-only: saved 10-day reports for one child, plus the live current period. */
export default function PeriodReports({ childId }: { childId: string }) {
  const [list, setList] = useState<{ saved: SavedReportSummary[]; currentPeriodStart: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/reports`);
      if (!res.ok) return setError("Couldn't load reports.");
      const data = await res.json();
      setList(data);
      setSelected(data.saved[0]?.periodStart ?? data.currentPeriodStart);
    })();
  }, [childId]);

  useEffect(() => {
    if (!selected) return;
    setReport(null);
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/reports/${selected}`);
      if (res.ok) setReport((await res.json()).report);
      else setError("Couldn't load that report.");
    })();
  }, [childId, selected]);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!list) return <p className="text-sm text-slate-500">Loading…</p>;

  const endOf = (start: string) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 9);
    return d.toISOString().slice(0, 10);
  };
  const periods = [
    { start: list.currentPeriodStart, label: `${shortDate(list.currentPeriodStart)} – ${shortDate(endOf(list.currentPeriodStart))} (so far)` },
    ...list.saved.map((s) => ({
      start: s.periodStart,
      label: `${shortDate(s.periodStart)} – ${shortDate(s.periodEnd)} · ${pct(s)}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        A detailed report is saved for every 10-day period once it ends. Only admin can see these.
      </p>
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.start}
            onClick={() => setSelected(p.start)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              selected === p.start ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {report ? <ReportView report={report} /> : <p className="text-sm text-slate-500">Loading…</p>}
    </div>
  );
}
