"use client";

import { useEffect } from "react";

/** Registers public/sw.js so the installed app gets an offline page instead of
 * the browser's error screen. Production only - in `next dev` a service worker
 * would cache build files that change on every edit. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal: the site works exactly the same without it.
    });
  }, []);
  return null;
}
