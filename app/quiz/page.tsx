"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAutoRefresh } from "@/components/AutoRefresh";
import type { Level } from "@/lib/config";
import { fireSmallConfetti, fireRoundConfetti, firePerfectConfetti } from "@/lib/confetti";
import { playCorrectSound, playWrongSound, playPerfectSound, playRoundDoneSound } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";
import Spinner from "@/components/Spinner";

interface Question {
  position: number;
  category: string;
  questionText: string;
  options: string[];
  shownAt: string;
}

interface RoundStart {
  roundId: string;
  level: Level;
  kind: "standard" | "review" | "checkup";
  totalQuestions: number;
  timeLimitSeconds: number;
  explainSeconds: number;
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
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <QuizPageInner />
    </Suspense>
  );
}

function QuizPageInner() {
  useAutoRefresh();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLevel = searchParams.get("level");
  const reviewMode = searchParams.get("mode") === "review";
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

  // Deliberately does NOT compare the client's clock to the server's
  // `shownAt` timestamp - if a device's clock is off (common enough on
  // phones/tablets), Date.now() - shownAt can already be "expired" on the
  // very first tick, instantly auto-submitting every question as a timeout
  // before the kid ever sees it. Counting down from the moment *this
  // client* started watching sidesteps clock skew entirely. The real
  // timeout enforcement lives server-side anyway (both timestamps compared
  // there come from the same server clock), so this is purely the visual
  // countdown - a little generous under network delay is fine; a little
  // short (the old bug) is not.
  const startTimer = useCallback((limitSeconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const localStart = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - localStart) / 1000;
      setSecondsLeft(Math.max(0, Math.ceil(limitSeconds - elapsed)));
    };
    tick();
    timerRef.current = setInterval(tick, 250);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/round/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            reviewMode ? { mode: "review" } : requestedLevel ? { level: Number(requestedLevel) } : {}
          ),
        });
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
        startTimer(start.timeLimitSeconds);
      } catch {
        setError("Network error starting the round.");
        setPhase("error");
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer, requestedLevel, reviewMode]);

  // Auto-submit as a miss once the timer hits zero, so a kid who freezes up
  // still sees the explanation instead of being stuck.
  useEffect(() => {
    if (phase === "question" && secondsLeft === 0 && !submittedRef.current) {
      void submitAnswer(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase]);

  // Bigger celebration once, right when the "done" screen first appears -
  // not on every re-render while it's showing.
  useEffect(() => {
    if (phase !== "done" || !result || !round) return;
    if (result.correctCount === round.totalQuestions) {
      firePerfectConfetti();
      playPerfectSound();
    } else {
      fireRoundConfetti();
      playRoundDoneSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      // Reuses the exact same countdown the question phase just used (one
      // timer on screen at a time, never two) to force a minimum read of
      // the explanation before "Next question" unlocks. round.explainSeconds
      // comes from the server (level default or an admin's per-child
      // override - see lib/config.ts's effectiveExplainSeconds()); 0 means
      // the button unlocks immediately, since startTimer(0) ticks straight
      // to secondsLeft = 0.
      startTimer(round.explainSeconds);
      if (data.isCorrect) {
        fireSmallConfetti();
        playCorrectSound();
      } else {
        playWrongSound();
      }
    } catch {
      setError("Network error submitting your answer.");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextQuestion() {
    if (!round || !question || secondsLeft > 0) return;
    if (timerRef.current) clearInterval(timerRef.current);
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
      startTimer(round.timeLimitSeconds);
    } catch {
      setError("Network error loading the next question.");
      setPhase("error");
    }
  }

  // Plain <Link> navigation away from this "round just finished" screen was
  // occasionally landing on a dashboard still showing the pre-round points
  // balance/rounds-left until a manual reload - router.refresh() right after
  // the push forces that destination's server data to be refetched instead
  // of reusing whatever was last cached for it.
  function goTo(href: string) {
    router.push(href);
    router.refresh();
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
        {round?.kind === "review" && (
          <p className="text-sm text-slate-500">Review round - practice only, no points awarded.</p>
        )}
        {round?.kind === "checkup" && (
          <p className="text-sm font-medium text-violet-600">
            🧠 Checkup complete - nice work showing you&apos;ve really got it!
          </p>
        )}
        {result.perfectBonus > 0 && (
          <p className="font-semibold text-amber-600">+{result.perfectBonus} perfect round bonus! 🏆</p>
        )}
        <p className="text-4xl font-extrabold text-brand-600">{result.newBalance} pts</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => goTo("/dashboard")}
            className="rounded-full bg-white px-6 py-3 font-medium shadow-sm ring-1 ring-slate-100"
          >
            Dashboard
          </button>
          <button
            onClick={() => goTo("/rewards")}
            className="rounded-full bg-brand-500 px-6 py-3 font-medium text-white"
          >
            View rewards
          </button>
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
          {result.isCorrect && round.kind !== "review" && (
            <p className="mt-1 font-semibold text-brand-600">
              +{result.pointsAwarded} points{result.streak >= 3 ? " 🔥 streak bonus!" : ""}
            </p>
          )}
          <p className="mt-4 text-sm font-medium text-slate-700">{question.questionText}</p>
          <p className="mt-3 text-sm text-slate-600">
            Correct answer: <span className="font-semibold">{question.options[result.correctIndex]}</span>
          </p>
          <p className="mt-2 text-sm text-slate-500">{result.explanation}</p>
        </div>
        <button
          onClick={nextQuestion}
          disabled={secondsLeft > 0}
          className="rounded-2xl bg-brand-500 p-5 text-lg font-bold text-white shadow-sm active:bg-brand-600 disabled:opacity-60"
        >
          {secondsLeft > 0
            ? `📖 Read the explanation… ${secondsLeft}s`
            : result.roundComplete
              ? "See results"
              : "Next question →"}
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 pt-8">
      <ProgressHeader position={question.position} total={round.totalQuestions} />

      {round.kind === "review" && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-sm font-medium text-sky-700 ring-1 ring-sky-200">
          🔁 Review round - similar questions to ones you missed, practice only, no points this time
        </p>
      )}

      {round.kind === "checkup" && (
        <p className="rounded-xl bg-violet-50 px-3 py-2 text-center text-sm font-medium text-violet-700 ring-1 ring-violet-200">
          🧠 Quick checkup - similar to one you missed before. This one counts!
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-500 ring-1 ring-slate-100">
          {CATEGORY_LABEL[question.category] ?? question.category}
        </span>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              secondsLeft <= 10 ? "bg-rose-100 text-rose-600" : "bg-brand-100 text-brand-700"
            }`}
          >
            ⏱ {secondsLeft}s
          </span>
        </div>
      </div>

      <h2 className="text-xl font-semibold leading-snug">{question.questionText}</h2>

      <div className="grid gap-3">
        {question.options.map((opt, i) => (
          <button
            key={i}
            disabled={submitting}
            onClick={() => submitAnswer(i)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left text-lg font-medium shadow-sm ring-1 ring-slate-100 active:bg-brand-50 disabled:opacity-60"
          >
            {opt}
            {submitting && selected === i && <Spinner className="h-5 w-5 shrink-0 text-brand-500" />}
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
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      {children === "Loading…" && <Spinner className="h-8 w-8 text-brand-500" />}
      {children}
    </main>
  );
}
