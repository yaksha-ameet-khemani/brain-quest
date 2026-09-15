import "server-only";

// Minimal in-memory rate limiter. Good enough to stop a kid (or anyone else)
// from rapid-firing PIN guesses against a single serverless instance. It is
// NOT a distributed rate limiter - on Vercel, each warm instance has its own
// counter, and a cold start resets it. For a private family app behind an
// obscure URL that's an acceptable trade-off to stay at $0 (a real
// distributed limiter needs Redis/Upstash); it's a backstop, not the only
// defense - PINs are hashed at rest regardless (see lib/pin.ts).

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}
