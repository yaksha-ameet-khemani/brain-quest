"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function ParentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        router.push("/parent");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
          return;
        }
        setInfo("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      }
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
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-slate-200 p-3"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-brand-500 p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : mode === "signin" ? "Sign In" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-sm text-brand-600 underline"
      >
        {mode === "signin" ? "First time? Create your parent account" : "Already have an account? Sign in"}
      </button>

      {mode === "signup" && (
        <p className="text-xs text-slate-400">
          After creating your one parent account, turn off public sign-ups in the Supabase dashboard
          (Authentication → Settings) so nobody else can register - see docs/SETUP.md.
        </p>
      )}
    </main>
  );
}
