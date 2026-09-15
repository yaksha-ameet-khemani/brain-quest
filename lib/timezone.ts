// No extra date library needed - Intl covers day-boundary math fine.

const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

/** "YYYY-MM-DD" for `when` (default: now) as seen in APP_TIMEZONE. Two calls
 * made a few hours apart on the same calendar day in that timezone return the
 * same string, which is all the daily-round-limit check needs. */
export function localDateKey(when: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Start-of-today and start-of-tomorrow in APP_TIMEZONE, as UTC instants -
 * handy for a `created_at >= startOfToday` query against Postgres timestamps. */
export function todayRangeUtc(when: Date = new Date()): { start: Date; end: Date } {
  const key = localDateKey(when);
  // Find the UTC instant that corresponds to 00:00:00 on `key` in TZ by
  // bisecting isn't necessary - Postgres/JS can compare ISO dates directly
  // if we just widen the window by the max UTC offset (26h) and filter in
  // SQL using the same localDateKey on the other side isn't available in
  // SQL easily, so instead we compute the offset directly.
  const utcGuess = new Date(`${key}T00:00:00Z`);
  const offsetMinutes = getOffsetMinutes(when);
  const start = new Date(utcGuess.getTime() - offsetMinutes * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

function getOffsetMinutes(when: Date): number {
  // Difference between the wall-clock time Intl reports for TZ and the
  // actual UTC wall-clock time, in minutes. Positive = TZ is ahead of UTC.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(when);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - when.getTime()) / 60_000);
}
