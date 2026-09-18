"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import Spinner from "@/components/Spinner";
import { formatRelativeTime } from "@/lib/format";

export default function PinEntry({
  childId,
  name,
  avatar,
  photoDataUrl,
  lastLoginAt,
}: {
  childId: string;
  name: string;
  avatar: string;
  photoDataUrl?: string | null;
  lastLoginAt?: string | null;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function press(digit: string) {
    setError(null);
    if (pin.length >= 6) return;
    setPin((p) => p + digit);
  }

  function backspace() {
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/kid-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setPin("");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center gap-6 pt-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center text-6xl">
        <Avatar photoDataUrl={photoDataUrl} avatar={avatar} name={name} />
      </div>
      <h1 className="text-2xl font-semibold">Hi, {name}! Enter your PIN</h1>

      <div className="flex gap-3">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <div
            key={i}
            className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand-400"
          >
            {i < pin.length && <div className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
          </div>
        ))}
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {lastLoginAt !== undefined && (
        <p className="text-xs text-slate-400">Last played: {formatRelativeTime(lastLoginAt)}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 w-16 rounded-2xl bg-white text-2xl font-semibold shadow-sm ring-1 ring-slate-100 active:bg-brand-50"
          >
            {d}
          </button>
        ))}
        <button
          onClick={backspace}
          className="h-16 w-16 rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-100 active:bg-brand-50"
        >
          ⌫
        </button>
        <button
          onClick={() => press("0")}
          className="h-16 w-16 rounded-2xl bg-white text-2xl font-semibold shadow-sm ring-1 ring-slate-100 active:bg-brand-50"
        >
          0
        </button>
        <button
          onClick={submit}
          disabled={pin.length < 4 || loading}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-xl font-semibold text-white shadow-sm disabled:opacity-40 active:bg-brand-600"
        >
          {loading ? <Spinner /> : "Go"}
        </button>
      </div>
    </main>
  );
}
