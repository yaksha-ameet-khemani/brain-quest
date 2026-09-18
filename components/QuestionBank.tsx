"use client";

import Link from "next/link";
import { ALL_LEVELS, type Level } from "@/lib/config";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAutoRefresh } from "@/components/AutoRefresh";
import Spinner from "@/components/Spinner";

interface BankQuestion {
  id: string;
  level: Level;
  category: "logic" | "riddle" | "spatial";
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  concept: string | null;
  isActive: boolean;
  attempts: number;
  correct: number;
  successRate: number | null;
}

const BLANK_FORM = {
  level: "1",
  category: "logic",
  questionText: "",
  options: ["", "", "", ""],
  correctOptionIndex: "0",
  explanation: "",
  concept: "",
};

export default function QuestionBank() {
  useAutoRefresh();
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<"all" | "1" | "2" | "3">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "logic" | "riddle" | "spatial">("all");
  const [showInactive, setShowInactive] = useState(false);

  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/questions");
    if (res.ok) setQuestions((await res.json()).questions);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () =>
      questions.filter((q) => {
        if (levelFilter !== "all" && String(q.level) !== levelFilter) return false;
        if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
        if (!showInactive && !q.isActive) return false;
        return true;
      }),
    [questions, levelFilter, categoryFilter, showInactive]
  );

  function startEdit(q: BankQuestion) {
    setEditingId(q.id);
    setForm({
      level: String(q.level),
      category: q.category,
      questionText: q.questionText,
      options: [...q.options],
      correctOptionIndex: String(q.correctOptionIndex),
      explanation: q.explanation,
      concept: q.concept ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK_FORM);
  }

  async function toggleActive(q: BankQuestion) {
    setTogglingId(q.id);
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !q.isActive }),
      });
      if (res.ok) await refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const payload = {
        level: Number(form.level),
        category: form.category,
        questionText: form.questionText,
        options: form.options,
        correctOptionIndex: Number(form.correctOptionIndex),
        explanation: form.explanation,
        concept: form.concept.trim() || null,
      };
      const res = await fetch(editingId ? `/api/admin/questions/${editingId}` : "/api/admin/questions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not save question.");
        return;
      }
      setMessage(editingId ? "Question updated." : "Question added.");
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
      <h1 className="text-2xl font-bold">📚 Question Bank</h1>
      <p className="-mt-4 text-sm text-slate-500">
        Manage the curated logic/riddle/spatial questions and see how kids are doing on each one. Math
        questions are generated automatically and aren&apos;t stored here.
      </p>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-3 font-bold">{editingId ? "Edit question" : "Add a question"}</h2>
        <form onSubmit={submit} className="grid gap-3">
          <div className="flex gap-3">
            <select
              value={form.level}
              onChange={(e) => setForm((s) => ({ ...s, level: e.target.value }))}
              className="rounded-xl border border-slate-200 p-3"
            >
              {ALL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </select>
            <select
              value={form.category}
              onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              className="flex-1 rounded-xl border border-slate-200 p-3"
            >
              <option value="logic">Logic</option>
              <option value="riddle">Riddle</option>
              <option value="spatial">Spatial</option>
            </select>
          </div>
          <textarea
            required
            placeholder="Question text"
            value={form.questionText}
            onChange={(e) => setForm((s) => ({ ...s, questionText: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
            rows={2}
          />
          <div className="grid gap-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correctOption"
                  checked={Number(form.correctOptionIndex) === i}
                  onChange={() => setForm((s) => ({ ...s, correctOptionIndex: String(i) }))}
                />
                <input
                  required
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      options: s.options.map((o, idx) => (idx === i ? e.target.value : o)),
                    }))
                  }
                  className="flex-1 rounded-xl border border-slate-200 p-2"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">The radio button marks the correct answer.</p>
          <textarea
            required
            placeholder="Explanation (shown after answering)"
            value={form.explanation}
            onChange={(e) => setForm((s) => ({ ...s, explanation: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
            rows={2}
          />
          <input
            placeholder="Concept tag (optional, e.g. 'odd-one-out')"
            value={form.concept}
            onChange={(e) => setForm((s) => ({ ...s, concept: e.target.value }))}
            className="rounded-xl border border-slate-200 p-3"
          />
          <p className="-mt-2 text-xs text-slate-400">
            Group questions that test the same skill so a child&apos;s daily checkup can swap in a different
            question on that skill instead of a random one from the category.
          </p>
          {message && <p className="text-sm text-brand-700">{message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving && <Spinner />}
              {saving ? "Saving…" : editingId ? "Save changes" : "Add question"}
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
        {(["all", "1", "2", "3"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              levelFilter === l ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {l === "all" ? "All levels" : `Level ${l}`}
          </button>
        ))}
        {(["all", "logic", "riddle", "spatial"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              categoryFilter === c ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
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
          {filtered.map((q) => (
            <div
              key={q.id}
              className={`rounded-2xl p-4 shadow-sm ring-1 ${
                q.isActive ? "bg-white ring-slate-100" : "bg-slate-50 ring-slate-200 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize">
                      {q.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Level {q.level}</span>
                    {q.concept && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">
                        {q.concept}
                      </span>
                    )}
                    {!q.isActive && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-600">
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{q.questionText}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Correct answer: <span className="font-semibold">{q.options[q.correctOptionIndex]}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-500">
                  {q.attempts > 0 ? (
                    <>
                      <p className="text-lg font-bold text-brand-600">{Math.round((q.successRate ?? 0) * 100)}%</p>
                      <p>
                        {q.correct}/{q.attempts} correct
                      </p>
                    </>
                  ) : (
                    <p>Not attempted yet</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => startEdit(q)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(q)}
                  disabled={togglingId === q.id}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                    q.isActive ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {togglingId === q.id && <Spinner className="h-3 w-3" />}
                  {q.isActive ? "Archive" : "Restore"}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-slate-500">No questions match this filter.</p>}
        </section>
      )}
    </main>
  );
}
