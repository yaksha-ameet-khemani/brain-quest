"use client";

import { useEffect, useState } from "react";
import type { HistoryDay, PointsHistory as PointsHistoryData } from "@/lib/pointsHistory";

const STATUS_LABEL: Record<HistoryDay["requests"][number]["status"], string> = {
  pending: "⏳ pending",
  approved: "👍 approved",
  denied: "✖️ denied (refunded)",
  fulfilled: "🎉 given",
};

function signed(n: number): string {
  if (n === 0) return "–";
  return n > 0 ? `+${n}` : `${n}`;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** One row per day for the last 30 days - points in/out, the balance at the
 * end of that day, play activity, login times, and any reward requests.
 * `endpoint` is the admin per-child route or the kid's own `/api/history`. */
export default function PointsHistory({ endpoint, forKid = false }: { endpoint: string; forKid?: boolean }) {
  const [data, setData] = useState<PointsHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    (async () => {
      const res = await fetch(endpoint);
      if (res.ok) setData(await res.json());
      else setError("Couldn't load history.");
    })();
  }, [endpoint]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">📅 Last 30 days</h2>
      <p className="mt-1 text-xs text-slate-500">
        {forKid
          ? "Newest first. Points are taken as soon as you request a reward. If a parent says no, you get them back as a refund."
          : "Newest first. \"Spent\" is taken the moment a reward is requested; a denied request shows up as a refund."}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-rose-700">{error}</p>
      ) : data === null ? (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-2 font-semibold">Date</th>
                  <th className="py-2 pr-2 text-right font-semibold">Earned</th>
                  <th className="py-2 pr-2 text-right font-semibold">Spent</th>
                  <th className="py-2 pr-2 text-right font-semibold">Refund / adj.</th>
                  <th className="py-2 pr-2 text-right font-semibold">Balance</th>
                  <th className="py-2 pr-2 text-right font-semibold">Rounds</th>
                  <th className="py-2 pr-2 text-right font-semibold">Correct</th>
                  <th className="py-2 pr-2 text-right font-semibold">Logged in at</th>
                  <th className="py-2 font-semibold">Reward requests</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const idle =
                    d.earned === 0 && d.redeemed === 0 && d.refunded + d.adjusted === 0 && d.logins.length === 0;
                  return (
                    <tr
                      key={d.date}
                      className={`border-b border-slate-100 align-top ${
                        d.requests.length > 0 ? "bg-amber-50" : idle ? "text-slate-400" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap py-2 pr-2 font-medium">
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-2 pr-2 text-right text-emerald-700">{signed(d.earned)}</td>
                      <td className="py-2 pr-2 text-right text-rose-700">{signed(d.redeemed)}</td>
                      <td className="py-2 pr-2 text-right">{signed(d.refunded + d.adjusted)}</td>
                      <td className="py-2 pr-2 text-right font-bold">{d.closingBalance}</td>
                      <td className="py-2 pr-2 text-right">{d.roundsCompleted || "–"}</td>
                      <td className="whitespace-nowrap py-2 pr-2 text-right">
                        {d.answered ? `${d.correct}/${d.answered}` : "–"}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {d.logins.length === 0 ? (
                          "–"
                        ) : (
                          <ul className="grid gap-0.5">
                            {d.logins.map((t, i) => (
                              <li key={t + i} className="whitespace-nowrap">
                                {timeOf(t)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-2">
                        {d.requests.length === 0 ? (
                          "–"
                        ) : (
                          <ul className="grid gap-0.5">
                            {d.requests.map((r) => (
                              <li key={r.requestedAt} className="whitespace-nowrap">
                                {r.rewardName} ({r.cost}) · {timeOf(r.requestedAt)} · {STATUS_LABEL[r.status]}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Balance before this period: {data.openingBalance}</p>
        </>
      )}
    </section>
  );
}
