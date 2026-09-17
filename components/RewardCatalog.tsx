"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAutoRefresh } from "@/components/AutoRefresh";

interface Reward {
  id: string;
  name: string;
  cost: number;
  emoji: string;
  isActive: boolean;
  timesRedeemed: number;
}

const BLANK_FORM = {
  name: "",
  cost: "",
  emoji: "🎁",
};

export default function RewardCatalog() {
  useAutoRefresh();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/rewards");
    if (res.ok) setRewards((await res.json()).rewards);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => rewards.filter((r) => showInactive || r.isActive),
    [rewards, showInactive]
  );

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setForm({ name: r.name, cost: String(r.cost), emoji: r.emoji });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK_FORM);
  }

  async function toggleActive(r: Reward) {
    const res = await fetch(`/api/admin/rewards/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    if (res.ok) await refresh();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        cost: Number(form.cost),
        emoji: form.emoji.trim() || "🎁",
      };
      const res = await fetch(editingId ? `/api/admin/rewards/${editingId}` : "/api/admin/rewards", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save reward.");
        return;
      }
      setMessage(editingId ? "Reward updated." : "Reward added.");
      cancelEdit();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-col gap-6 pt-6">
      <Link href="/parent" className="text-sm text-slate-500">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold">🎁 Rewards Catalog</h1>
      <p className="-mt-4 text-sm text-slate-500">
        What kids can redeem their points for. Archiving a reward hides it from the catalog without
        touching anyone&apos;s past redemption history.
      </p>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 font-bold">{editingId ? "Edit reward" : "Add a reward"}</h2>
        <form onSubmit={submit} className="grid gap-3">
          <div className="flex gap-3">
            <input
              required
              placeholder="Emoji"
              value={form.emoji}
              onChange={(e) => setForm((s) => ({ ...s, emoji: e.target.value }))}
              className="w-20 rounded-xl border border-slate-200 p-3 text-center text-xl"
            />
            <input
              required
              placeholder="Reward name"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="flex-1 rounded-xl border border-slate-200 p-3"
            />
          </div>
          <input
            required
            type="number"
            min={1}
            step={1}
            placeholder="Cost in points"
            value={form.cost}
            onChange={(e) => setForm((s) => ({ ...s, cost: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          {message && <p className="text-sm text-brand-700">{message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "…" : editingId ? "Save changes" : "Add reward"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="rounded-xl bg-slate-100 px-4 py-3 font-semibold">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowInactive((s) => !s)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            showInactive ? "bg-slate-700 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
          }`}
        >
          {showInactive ? "Showing archived" : "Show archived"}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <section className="grid gap-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-3 rounded-2xl p-4 shadow-sm ring-1 ${
                r.isActive ? "bg-white ring-slate-100" : "bg-slate-50 ring-slate-200 opacity-70"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-2xl">{r.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.cost} pts · {r.timesRedeemed} redemption{r.timesRedeemed === 1 ? "" : "s"}
                    {!r.isActive && " · Archived"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => startEdit(r)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    r.isActive ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {r.isActive ? "Archive" : "Restore"}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-slate-500">No rewards match this filter.</p>}
        </section>
      )}
    </main>
  );
}
