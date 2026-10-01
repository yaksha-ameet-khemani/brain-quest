"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { IDLE_LOGOUT_MINUTES } from "@/lib/config";

const IDLE_MS = IDLE_LOGOUT_MINUTES * 60_000;
const STORAGE_KEY = "bq:lastActivity";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
const CHECK_EVERY_MS = 15_000;

// Pages that need a sign-in. Everything else (the child picker, a kid's PIN
// screen, parent sign-in) has no one to log out.
const SIGNED_IN_PREFIXES = ["/dashboard", "/quiz", "/rewards", "/history", "/parent"];

function readLast(): number | null {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeLast(now: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // Private mode etc. - the in-page timer below still works.
  }
}

/** Logs a device out after IDLE_LOGOUT_MINUTES with no taps, typing or
 * scrolling. The last-activity time is kept in localStorage, so a phone left
 * locked (when timers don't run) or an app reopened the next day is logged
 * out as soon as it's back on screen, and activity in one tab keeps the
 * others alive. Opening a page is NOT activity - that is exactly how a
 * reopened app comes back.
 * - On a signed-in page, going idle logs out and returns to the child picker.
 * - On a signed-out page (child picker, PIN keypad, parent sign-in), an idle
 *   device has its old sessions quietly logged out first - otherwise someone
 *   could tap "Parent Mode" an hour later and walk straight in.
 * Logs out both the kid and the parent session - this is about the device,
 * not one person. */
export default function IdleLogout() {
  const pathname = usePathname();
  const signedIn = SIGNED_IN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    let lastActive = Date.now(); // in-memory fallback when localStorage is unavailable
    let lastWrite = 0;
    let busy = false;

    function markActive() {
      const now = Date.now();
      lastActive = now;
      if (now - lastWrite < 5_000) return; // no need to write on every scroll event
      lastWrite = now;
      writeLast(now);
    }

    async function endSessions() {
      await Promise.allSettled([
        fetch("/api/auth/kid-logout", { method: "POST" }),
        fetch("/api/auth/parent-logout", { method: "POST" }),
      ]);
    }

    async function onIdle() {
      if (busy) return;
      busy = true;
      await endSessions();
      writeLast(Date.now()); // the next sign-in starts fresh
      if (signedIn) {
        window.location.replace("/?loggedOut=idle");
      } else {
        busy = false;
      }
    }

    function check() {
      const stored = readLast();
      if (Date.now() - Math.max(lastActive, stored ?? 0) > IDLE_MS) void onIdle();
    }

    const stored = readLast();
    if (stored === null) {
      writeLast(Date.now());
    } else if (Date.now() - stored > IDLE_MS) {
      void onIdle();
      if (signedIn) return;
    }

    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, markActive, { passive: true });
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, markActive);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [signedIn]);

  return null;
}
