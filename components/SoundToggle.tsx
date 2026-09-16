"use client";

import { useEffect, useState } from "react";
import { isSoundMuted, setSoundMuted } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-100"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
