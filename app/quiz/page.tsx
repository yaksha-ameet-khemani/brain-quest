"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Question {
  position: number;
  category: string;
  questionText: string;
  options: string[];
  shownAt: string;
}

interface RoundStart {
  roundId: string;
  level: 1 | 2;
  totalQuestions: number;
  timeLimitSeconds: number;
  question: Question;
}

interface AnswerResult {
  isCorrect: boolean;
  timedOut: boolean;
  correctIndex: number;
  explanation: string;
  pointsAwarded: number;
  streak: number;
  roundComplete: boolean;
  perfectBonus: number;
  correctCount: number;
  newBalance: number;
}

type Phase = "loading" | "error" | "question" | "feedback" | "done";

const CATEGORY_LABEL: Record<string, string> = {
  math: "🔢 Math",
  logic: "🧩 Logic",
  riddle: "❓ Riddle",
  spatial: "📐 Spatial",
};

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<RoundStart | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  const startTimer = useCallback((shownAt: string, limitSeconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const elapsed = (Date.now() - new Date(shownAt).getTime()) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(limitSeconds - elapsed)));
    };
    tick();
    timerRef.current = setInterval(tick, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/round/start", { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not start a round.");
          setPhase("error");
          return;
        }
        const start: RoundStart = data;
        setRound(start);
        setQuestion(start.question);
        setPhase("question");
        startTimer(start.question.shownAt, start.timeLimitSeconds);
      } catch {
        setError("Network error starting the round.");
        setPhase("error");
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Auto-submit as a miss once the timer hits zero, so a kid who freezes up
  // still sees the explanation instead of being stuck.
  useEffect(() => {
    if (phase === "question" && secondsLeft === 0 && !submittedRef.current) {
      void submitAnswer(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  async function submitAnswer(selectedIndex: number) {
    if (!round || !question || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSelected(selectedIndex);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const res = await fetch(`/api/round/${round.roundId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: question.position, selectedIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your answer.");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("feedback");
    } catch {
      setError("Network error submitting your answer.");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextQuestion() {
    if (!round || !question) return;
    if (result?.roundComplete) {
      setPhase("done");
      return;
    }
    setPhase("loading");
    setResult(null);
    setSelected(null);
    submittedRef.current = false;
    try {
      const res = await fetch(`/api/round/${round.roundId}/question/${question.position + 1}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load the next question.");
        setPhase("error");
        return;
      }
      setQuestion(data.question);
      setPhase("question");
      startTimer(data.question.shownAt, round.timeLimitSeconds);
    } catch {
      setError("Network error loading the next question.");
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (phase === "error") {
    return (
      <CenteredMessage>
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand-600 underline">
          Back to dashboard
        </Link>
      </CenteredMessage>
    );
  }

  if (phase === "done" && result) {
    return (
      <main className="flex flex-col items-center gap-6 pt-16 text-center">
        <p className="text-6xl">{result.correctCount === round?.totalQuestions ? "🌟" : "🎉"}</p>
        <h1 className="text-2xl font-bold">Round complete!</h1>
        <p className="text-slate-600">
          {result.correctCount} / {round?.totalQuestions} correct
        </p>
        {result.perfectBonus > 0 && (
          <p className="font-semibold text-amber-600">+{result.perfectBonus} perfect round bonus! 🏆</p>
        )}
        <p className="text-4xl font-extrabold text-brand-600">{result.newBalance} pts</p>
        <div className="mt-4 flex gap-3">
          <Link href="/dashboard" className="rounded-full bg-white px-6 py-3 font-medium shadow-sm ring-1 ring-slate-100">
            Dashboard
          </Link>
          <Link href="/rewards" className="rounded-full bg-brand-500 px-6 py-3 font-medium text-white">
            View rewards
          </Link>
        </div>
      </main>
    );
  }

  if (!round || !question) return <CenteredMessage>Loading…</CenteredMessage>;

  if (phase === "feedback" && result) {
    return (
      <main className="flex flex-col gap-6 pt-8">
        <ProgressHeader position={question.position} total={round.totalQuestions} />
        <div
          className={`rounded-2xl p-6 text-center shadow-sm ring-1 ${
            result.isCorrect ? "bg-emerald-50 ring-emerald-200" : "bg-rose-50 ring-rose-200"
          }`}
        >
          <p className="text-4xl">{result.isCorrect ? "✅" : result.timedOut ? "⏰" : "❌"}</p>
          <p className="mt-2 text-lg font-bold">
            {result.isCorrect ? "Correct!" : result.timedOut ? "Time's up!" : "Not quite"}
          </p>
          {result.isCorrect && (
            <p className="mt-1 font-semibold text-brand-600">
              +{result.pointsAwarded} points{result.streak >= 3 ? " 🔥 streak bonus!" : ""}
            </p>
          )}
          <p className="mt-3 text-sm text-slate-600">
            Correct answer: <span className="font-semibold">{question.options[result.correctIndex]}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">{result.explanation}</p>
        </div>
        <button
          onClick={nextQuestion}
          className="rounded-2xl bg-brand-500 p-5 text-lg font-bold text-white shadow-sm active:bg-brand-600"
        >
          {result.roundComplete ? "See results" : "Next question →"}
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 pt-8">
      <ProgressHeader position={question.position} total={round.totalQuestions} />

      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-500 ring-1 ring-slate-100">
          {CATEGORY_LABEL[question.category] ?? question.category}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            secondsLeft <= 10 ? "bg-rose-100 text-rose-600" : "bg-brand-100 text-brand-700"
          }`}
        >
          ⏱ {secondsLeft}s
        </span>
      </div>

      <h2 className="text-xl font-semibold leading-snug">{question.questionText}</h2>

      <div className="grid gap-3">
        {question.options.map((opt, i) => (
          <button
            key={i}
            disabled={submitting}
            onClick={() => submitAnswer(i)}
            className="rounded-2xl bg-white p-4 text-left text-lg font-medium shadow-sm ring-1 ring-slate-100 active:bg-brand-50 disabled:opacity-60"
          >
            {opt}
          </button>
        ))}
      </div>
    </main>
  );
}

function ProgressHeader({ position, total }: { position: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i <= position ? "bg-brand-500" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-[60vh] flex-col items-center justify-center text-center">{children}</main>;
}
