"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Reward {
  id: string;
  name: string;
  cost: number;
  emoji: string;
}

interface Redemption {
  id: string;
  reward_name: string;
  cost: number;
  status: "pending" | "approved" | "denied" | "fulfilled";
  requested_at: string;
}

const STATUS_LABEL: Record<Redemption["status"], string> = {
  pending: "⏳ Waiting for a parent",
  approved: "👍 Approved",
  denied: "✖️ Denied (refunded)",
  fulfilled: "🎉 Given!",
};

export default function RewardsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<Redemption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [balanceRes, rewardsRes, historyRes] = await Promise.all([
      fetch("/api/balance"),
      fetch("/api/rewards"),
      fetch("/api/redeem"),
    ]);
    if (balanceRes.ok) setBalance((await balanceRes.json()).balance);
    if (rewardsRes.ok) setRewards((await rewardsRes.json()).rewards);
    if (historyRes.ok) setHistory((await historyRes.json()).redemptions);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function redeem(reward: Reward) {
    setMessage(null);
    setBusyId(reward.id);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not request that reward.");
        return;
      }
      setMessage(`Requested "${reward.name}"! Ask a parent to approve it.`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-col gap-6 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-500">
          ← Back
        </Link>
        <p className="text-lg font-bold text-brand-600">{balance ?? "…"} pts</p>
      </header>

      <h1 className="text-2xl font-bold">🎁 Rewards Catalog</h1>
      {message && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{message}</p>}

      <section className="grid gap-3">
        {rewards.map((r) => {
          const affordable = balance !== null && balance >= r.cost;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{r.emoji}</span>
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-slate-500">{r.cost} pts</p>
                </div>
              </div>
              <button
                onClick={() => redeem(r)}
                disabled={!affordable || busyId === r.id}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
              >
                {busyId === r.id ? "…" : affordable ? "Request" : "Locked"}
              </button>
            </div>
          );
        })}
        {rewards.length === 0 && <p className="text-center text-slate-500">No rewards yet - ask a parent to add some!</p>}
      </section>

      {history.length > 0 && (
        <>
          <h2 className="mt-4 text-lg font-bold">Your requests</h2>
          <section className="grid gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm ring-1 ring-slate-100">
                <span>{h.reward_name}</span>
                <span className="text-slate-500">{STATUS_LABEL[h.status]}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
