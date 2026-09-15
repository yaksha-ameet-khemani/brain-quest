"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export default function ParentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [checkedSignupState, setCheckedSignupState] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If no parent account exists yet, default straight to the sign-up form -
  // this is a single-household app, so the very first visitor is almost
  // certainly the parent setting things up for the first time.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/parent-signup");
        const data = await res.json();
        if (data.signupOpen) setMode("signup");
      } finally {
        setCheckedSignupState(true);
      }
    })();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "signin" ? "/api/auth/parent-login" : "/api/auth/parent-signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/parent");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col gap-6 pt-10">
      <Link href="/" className="text-sm text-slate-500">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">👤 Parent {mode === "signin" ? "Sign In" : "Sign Up"}</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-slate-200 p-3"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-slate-200 p-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !checkedSignupState}
          className="rounded-xl bg-brand-500 p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : mode === "signin" ? "Sign In" : "Create account"}
        </button>
      </form>

      {mode === "signin" && (
        <button onClick={() => setMode("signup")} className="text-sm text-brand-600 underline">
          First time? Create your parent account
        </button>
      )}
      {mode === "signup" && checkedSignupState && (
        <button onClick={() => setMode("signin")} className="text-sm text-brand-600 underline">
          Already have an account? Sign in
        </button>
      )}

      {mode === "signup" && (
        <p className="text-xs text-slate-400">
          Only one parent account is allowed for this app - once you create it, sign-ups close
          automatically (no dashboard setting to remember).
        </p>
      )}
    </main>
  );
}
