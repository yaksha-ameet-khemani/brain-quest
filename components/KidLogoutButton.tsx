"use client";

import { useRouter } from "next/navigation";

export default function KidLogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/kid-logout", { method: "POST" });
        router.push("/");
      }}
      className="text-sm text-slate-400 underline-offset-2 hover:underline"
    >
      Not you? Switch profile
    </button>
  );
}
