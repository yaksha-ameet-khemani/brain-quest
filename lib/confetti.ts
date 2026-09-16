"use client";

import confetti from "canvas-confetti";

/** A small burst for a single correct answer - enough to feel good without
 * being a distraction every few seconds through a whole round. */
export function fireSmallConfetti(): void {
  void confetti({
    particleCount: 40,
    spread: 55,
    startVelocity: 30,
    origin: { y: 0.7 },
  });
}

/** A bigger, two-sided burst for finishing a round. */
export function fireRoundConfetti(): void {
  void confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } });
  void confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } });
}

/** The big one - a perfect round. */
export function firePerfectConfetti(): void {
  const end = Date.now() + 700;
  const colors = ["#6366f1", "#f59e0b", "#10b981", "#ec4899"];
  (function frame() {
    void confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors });
    void confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
