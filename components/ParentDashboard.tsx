"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
}
interface ChildOverview {
  child: { id: string; name: string; avatar: string; level: 1 | 2 };
  balance: number;
  roundsPlayed: number;
  categoryStats: CategoryStat[];
}
interface Redemption {
  id: string;
  child_id: string;
  reward_name: string;
  cost: number;
  status: "pending" | "approved" | "denied" | "fulfilled";
  requested_at: string;
  child?: { name: string; avatar: string } | null;
}

export default function ParentDashboard({ parentEmail }: { parentEmail: string }) {
  const router = useRouter();
  const [overview, setOverview] = useState<ChildOverview[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newChild, setNewChild] = useState({ name: "", level: "1", pin: "", avatar: "🙂" });
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const [ov, rd] = await Promise.all([fetch("/api/parent/overview"), fetch("/api/parent/redemptions")]);
    if (ov.ok) setOverview((await ov.json()).overview);
    if (rd.ok) setRedemptions((await rd.json()).redemptions);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function decide(id: string, action: "approve" | "deny" | "fulfill") {
    setBusy(id);
    try {
      const res = await fetch("/api/parent/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId: id, action }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addChild(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChild.name,
          level: Number(newChild.level),
          pin: newChild.pin,
          avatar: newChild.avatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not add child.");
        return;
      }
      setNewChild({ name: "", level: "1", pin: "", avatar: "🙂" });
      setMessage(`Added ${data.child.name}!`);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  const pending = redemptions.filter((r) => r.status === "pending");
  const decided = redemptions.filter((r) => r.status !== "pending").slice(0, 10);

  return (
    <main className="flex flex-col gap-8 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">👤 Parent Dashboard</h1>
          <p className="text-sm text-slate-500">{parentEmail}</p>
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 underline">
          Sign out
        </button>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-bold">Pending reward requests</h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">Nothing waiting on you 🎉</p>}
        <div className="grid gap-3">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div>
                <p className="font-semibold">
                  {r.child?.avatar} {r.child?.name} wants: {r.reward_name}
                </p>
                <p className="text-sm text-slate-500">{r.cost} pts</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, "approve")}
                  className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  disabled={busy === r.id}
                  onClick={() => decide(r.id, "deny")}
                  className="rounded-full bg-rose-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>

        {decided.some((d) => d.status === "approved") && (
          <div className="mt-3 grid gap-3">
            {decided
              .filter((d) => d.status === "approved")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
                  <span>
                    {r.child?.avatar} {r.child?.name}: {r.reward_name} (approved, not yet given)
                  </span>
                  <button
                    disabled={busy === r.id}
                    onClick={() => decide(r.id, "fulfill")}
                    className="rounded-full bg-amber-500 px-3 py-1.5 font-semibold text-white"
                  >
                    Mark given
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Progress</h2>
        <div className="grid gap-4">
          {overview.map((o) => (
            <div key={o.child.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {o.child.avatar} {o.child.name} · Level {o.child.level}
                </p>
                <p className="font-bold text-brand-600">{o.balance} pts</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{o.roundsPlayed} rounds completed</p>
              {o.categoryStats.length > 0 && (
                <div className="mt-3 grid gap-1.5">
                  {o.categoryStats.map((c) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="w-16 capitalize text-slate-500">{c.category}</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-brand-400"
                          style={{ width: `${Math.round((c.correct / c.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-400">
                        {c.correct}/{c.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {overview.length === 0 && <p className="text-sm text-slate-500">No kid profiles yet - add one below.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Add a child profile</h2>
        <form onSubmit={addChild} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <input
            required
            placeholder="Name"
            value={newChild.name}
            onChange={(e) => setNewChild((s) => ({ ...s, name: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          <div className="flex gap-3">
            <input
              placeholder="Avatar emoji"
              value={newChild.avatar}
              onChange={(e) => setNewChild((s) => ({ ...s, avatar: e.target.value }))}
              className="w-24 rounded-xl border border-slate-200 p-3 text-center"
            />
            <select
              value={newChild.level}
              onChange={(e) => setNewChild((s) => ({ ...s, level: e.target.value }))}
              className="flex-1 rounded-xl border border-slate-200 p-3"
            >
              <option value="1">Level 1 (younger)</option>
              <option value="2">Level 2 (older)</option>
            </select>
          </div>
          <input
            required
            placeholder="4-6 digit PIN"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={newChild.pin}
            onChange={(e) => setNewChild((s) => ({ ...s, pin: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          {message && <p className="text-sm text-brand-700">{message}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-brand-500 p-3 font-semibold text-white disabled:opacity-50"
          >
            {creating ? "…" : "Add child"}
          </button>
        </form>
      </section>
    </main>
  );
}
