"use client";

import { useEffect } from "react";

/** Forces a fresh reload if this page was just restored from the browser's
 * back/forward cache (bfcache) - e.g. a kid finishes a quiz, the browser
 * navigates to /dashboard, and later they hit the phone's back button to
 * return to a screen that's showing points/rounds-left exactly as they were
 * before, not what actually happened since. The `pageshow` event's
 * `persisted` flag is specifically true for a bfcache restore - it does NOT
 * fire for our own in-app client-side navigation (Link/router.push), so
 * this only ever intervenes in the one case it's meant to. */
export function useAutoRefresh() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);
}

/** Component form for Server Component pages, which can't call hooks
 * directly - render this anywhere in the tree. Client components with
 * multiple early returns (like the quiz page) should call useAutoRefresh()
 * directly instead, before any conditional return. */
export default function AutoRefresh() {
  useAutoRefresh();
  return null;
}
