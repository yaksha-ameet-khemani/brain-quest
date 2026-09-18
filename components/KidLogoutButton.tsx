"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/Spinner";

export default function KidLogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/kid-logout", { method: "POST" });
      router.push("/");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loggingOut}
      className="flex items-center gap-1.5 text-sm text-slate-400 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {loggingOut && <Spinner className="h-3 w-3" />}
      Not you? Switch profile
    </button>
  );
}
