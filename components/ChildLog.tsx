"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

interface LogEntry {
  roundId: string;
  position: number;
  category: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  shownAt: string | null;
  answeredAt: string | null;
  pointsAwarded: number;
  durationSeconds: number | null;
}

interface ChildInfo {
  id: string;
  name: string;
  avatar: string;
  level: 1 | 2;
}

const CATEGORY_LABEL: Record<string, string> = {
  math: "🔢 Math",
  logic: "🧩 Logic",
  riddle: "❓ Riddle",
  spatial: "📐 Spatial",
};

function CategoryWeightsEditor({ childId }: { childId: string }) {
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/weights`);
      if (res.ok) setWeights((await res.json()).weights);
    })();
  }, [childId]);

  async function save() {
    if (!weights) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/children/${childId}/weights`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save.");
        return;
      }
      setWeights(data.weights);
      setMessage("Saved!");
    } finally {
      setSaving(false);
    }
  }

  if (!weights) return null;

  const total = Object.values(weights).reduce((s, w) => s + w, 0);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-bold">🎯 Section priorities</h2>
      <p className="mt-1 text-xs text-slate-500">
        Higher weight = shows up more often in this child&apos;s rounds. Set to 0 to skip a category
        entirely. Equal weights (the default) means equal odds for all four.
      </p>
      <div className="mt-3 grid gap-3">
        {Object.entries(weights).map(([category, weight]) => (
          <div key={category} className="flex items-center gap-3">
            <span className="w-24 text-sm font-medium">{CATEGORY_LABEL[category] ?? category}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={weight}
              onChange={(e) => setWeights((w) => ({ ...w!, [category]: Number(e.target.value) }))}
              className="flex-1"
            />
            <span className="w-16 text-right text-sm text-slate-500">
              {weight} ({total > 0 ? Math.round((weight / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "…" : "Save priorities"}
        </button>
        {message && <p className="text-sm text-brand-700">{message}</p>}
      </div>
    </section>
  );
}

export default function ChildLog({ childId, isAdmin }: { childId: string; isAdmin: boolean }) {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/parent/children/${childId}/log`);
      if (res.ok) {
        const data = await res.json();
        setChild(data.child);
        setLog(data.log);
      }
      setLoading(false);
    })();
  }, [childId]);

  const filtered = log.filter((l) => {
    if (filter === "correct") return l.isCorrect === true;
    if (filter === "wrong") return l.isCorrect === false;
    return true;
  });

  const totalTime = log.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  const correctCount = log.filter((l) => l.isCorrect === true).length;
  const wrongCount = log.filter((l) => l.isCorrect === false).length;

  if (loading) {
    return <p className="pt-10 text-center text-slate-500">Loading…</p>;
  }

  if (!child) {
    return <p className="pt-10 text-center text-slate-500">Child not found.</p>;
  }

  return (
    <main className="flex flex-col gap-6 pt-6">
      <Link href="/parent" className="text-sm text-slate-500">
        ← Back to dashboard
      </Link>

      <header className="flex items-center gap-3">
        <span className="text-4xl">{child.avatar}</span>
        <div>
          <h1 className="text-xl font-bold">{child.name}&apos;s full log</h1>
          <p className="text-sm text-slate-500">Level {child.level}</p>
        </div>
      </header>

      {isAdmin && <CategoryWeightsEditor childId={childId} />}

      <section className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
          <p className="text-lg font-bold">{log.length}</p>
          <p className="text-slate-500">Attempted</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-lg font-bold text-emerald-600">{correctCount}</p>
          <p className="text-slate-500">Correct</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-lg font-bold text-rose-500">{wrongCount}</p>
          <p className="text-slate-500">Wrong</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-3">
          <p className="text-lg font-bold text-brand-600">{formatDuration(totalTime)}</p>
          <p className="text-slate-500">Total time</p>
        </div>
      </section>

      <div className="flex gap-2">
        {(["all", "correct", "wrong"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="grid gap-3">
        {filtered.map((l, i) => (
          <div
            key={`${l.roundId}-${l.position}-${i}`}
            className={`rounded-2xl p-4 shadow-sm ring-1 ${
              l.isCorrect ? "bg-emerald-50 ring-emerald-100" : "bg-rose-50 ring-rose-100"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="capitalize">{l.category}</span>
              <span>
                {l.answeredAt ? new Date(l.answeredAt).toLocaleString() : "—"} ·{" "}
                {l.durationSeconds !== null ? formatDuration(l.durationSeconds) : "—"}
              </span>
            </div>
            <p className="mt-1 font-medium">{l.questionText}</p>
            <div className="mt-2 grid gap-1 text-sm">
              {l.options.map((opt, idx) => (
                <p
                  key={idx}
                  className={
                    idx === l.correctIndex
                      ? "font-semibold text-emerald-700"
                      : idx === l.selectedIndex
                        ? "font-semibold text-rose-600 line-through"
                        : "text-slate-500"
                  }
                >
                  {idx === l.correctIndex ? "✓ " : idx === l.selectedIndex ? "✗ " : "• "}
                  {opt}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {l.isCorrect ? `+${l.pointsAwarded} pts` : l.selectedIndex === null ? "Timed out" : "Incorrect"}
            </p>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-slate-500">No attempts yet.</p>}
      </section>
    </main>
  );
}
