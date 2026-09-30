"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";

interface PracticeRound {
  roundNo: number;
  questionCount: number;
  timesCompleted: number;
  bestCorrect: number | null;
  lastCorrect: number | null;
}

interface PracticeAnswer {
  roundNo: number;
  questionText: string;
  picked: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
  seconds: number | null;
}

interface PracticeSet {
  id: string;
  title: string;
  description: string | null;
  totalQuestions: number;
  rounds: PracticeRound[];
  roundsDone: number;
  assignedAt: string | null;
  answers: PracticeAnswer[];
}

/** Admin-only "Practice" tab on the child page: assign practice sets
 * (lib/practice.ts) and see how the child is doing on them. Practice answers
 * show up only here - never in the log, reports or skill map. */
export default function PracticeSets({ childId }: { childId: string }) {
  const [sets, setSets] = useState<PracticeSet[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAnswers, setOpenAnswers] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/children/${childId}/practice`);
      if (res.ok) setSets((await res.json()).sets);
      else setError("Could not load practice sets.");
    })();
  }, [childId]);

  async function toggle(set: PracticeSet) {
    setBusy(set.id);
    setError(null);
    const res = await fetch(`/api/admin/children/${childId}/practice`, {
      method: set.assignedAt ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: set.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSets(data.sets);
    else setError(data.error ?? "Could not update the assignment.");
    setBusy(null);
  }

  if (sets === null) {
    return <p className="text-sm text-slate-500">{error ?? "Loading…"}</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs text-slate-500">
        Extra practice questions you can give this child. They play them from their dashboard, 10 at a time, with the
        normal timer and explanations but no points. Their practice answers show only here, not in the log, reports or
        skill map.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {sets.length === 0 && <p className="text-sm text-slate-500">No practice sets yet.</p>}

      {sets.map((set) => (
        <div key={set.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">🎯 {set.title}</h2>
              {set.description && <p className="mt-0.5 text-xs text-slate-500">{set.description}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {set.totalQuestions} questions · {set.rounds.length} rounds
                {set.assignedAt && ` · assigned ${new Date(set.assignedAt).toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={() => toggle(set)}
              disabled={busy !== null}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                set.assignedAt ? "bg-white text-slate-600 ring-1 ring-slate-200" : "bg-brand-500 text-white"
              }`}
            >
              {busy === set.id && <Spinner className="h-3.5 w-3.5" />}
              {set.assignedAt ? "Unassign" : "Assign"}
            </button>
          </div>

          {(set.assignedAt || set.answers.length > 0) && (
            <>
              <p className="mt-3 text-sm font-semibold">
                {set.roundsDone} of {set.rounds.length} rounds done
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                {set.rounds.map((r) => (
                  <div
                    key={r.roundNo}
                    className={`rounded-xl p-2 ${r.timesCompleted > 0 ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-400"}`}
                  >
                    <p className="font-semibold">Round {r.roundNo}</p>
                    {r.timesCompleted > 0 ? (
                      <>
                        <p className="text-base font-bold">
                          {r.lastCorrect}/{r.questionCount}
                        </p>
                        <p>
                          {r.timesCompleted > 1 ? `played ${r.timesCompleted}x · best ${r.bestCorrect}` : "latest"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1">Not played</p>
                    )}
                  </div>
                ))}
              </div>

              {set.answers.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setOpenAnswers(openAnswers === set.id ? null : set.id)}
                    className="text-xs font-semibold text-brand-600 underline"
                  >
                    {openAnswers === set.id ? "Hide answers" : `Show answers (${set.answers.length})`}
                  </button>
                  {openAnswers === set.id && (
                    <ol className="mt-2 grid gap-1.5 text-sm">
                      {set.answers.map((a, i) => (
                        <li
                          key={i}
                          className={`rounded-xl px-3 py-2 ${a.isCorrect ? "bg-emerald-50" : "bg-rose-50"}`}
                        >
                          <p className="text-xs text-slate-400">
                            Round {a.roundNo} · {new Date(a.answeredAt).toLocaleString()}
                            {a.seconds !== null && ` · ${a.seconds}s`}
                          </p>
                          <p className="font-medium">
                            {a.isCorrect ? "✅" : "❌"} {a.questionText}
                          </p>
                          <p className="text-xs text-slate-600">
                            Picked: <span className="font-semibold">{a.picked ?? "no answer (time ran out)"}</span>
                            {!a.isCorrect && (
                              <>
                                {" "}
                                · Correct: <span className="font-semibold">{a.correctAnswer}</span>
                              </>
                            )}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
