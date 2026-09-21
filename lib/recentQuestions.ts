// Pure selection helpers for "don't hand a child a question they only just
// saw" - kept free of DB/server-only imports so they can be unit-tested on
// their own. Used by lib/buildRound.ts's pickSimilarBankQuestion().

/** A question that was never shown, or was last shown before `cutoffMs`
 * (i.e. outside the recent-memory window). Never-shown questions win over
 * merely-old ones. Returns null if every candidate was shown inside the
 * window. */
export function pickNotRecentlySeen<T extends { id: string }>(
  pool: T[],
  lastShownAt: Map<string, number>,
  cutoffMs: number,
  pickRandom: (items: T[]) => T
): T | null {
  const neverShown = pool.filter((q) => !lastShownAt.has(q.id));
  if (neverShown.length > 0) return pickRandom(neverShown);

  const outsideWindow = pool.filter((q) => (lastShownAt.get(q.id) ?? 0) < cutoffMs);
  return outsideWindow.length > 0 ? pickRandom(outsideWindow) : null;
}

/** Last resort when everything was shown recently: the one shown longest
 * ago, so a repeat is at least as stale as it can be. Null for an empty pool. */
export function pickLeastRecentlySeen<T extends { id: string }>(
  pool: T[],
  lastShownAt: Map<string, number>
): T | null {
  let best: T | null = null;
  let bestAt = Infinity;
  for (const q of pool) {
    const at = lastShownAt.get(q.id) ?? 0;
    if (at < bestAt) {
      best = q;
      bestAt = at;
    }
  }
  return best;
}
