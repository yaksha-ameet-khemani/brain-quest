import "server-only";
import { queryOne } from "@/lib/db";
import { PEN_PAPER_DEFAULT_SECONDS } from "@/lib/config";

/** Family-wide, admin-set game settings: whether a wrong answer docks a
 * child half the points a correct one would have earned, and how long pen &
 * paper questions get. See app/api/admin/settings/route.ts and
 * app/api/round/[roundId]/answer/route.ts. */

export async function getNegativeMarkingEnabled(): Promise<boolean> {
  const row = await queryOne<{ negative_marking: boolean }>(
    "SELECT negative_marking FROM game_settings LIMIT 1"
  );
  return row?.negative_marking ?? false;
}

/** No row exists until the first toggle (db/migrations/014 seeds none on
 * purpose) - upsert onto the single allowed row (id = true) either way. */
export async function setNegativeMarkingEnabled(enabled: boolean): Promise<boolean> {
  const row = await queryOne<{ negative_marking: boolean }>(
    `INSERT INTO game_settings (id, negative_marking) VALUES (true, $1)
     ON CONFLICT (id) DO UPDATE SET negative_marking = $1
     RETURNING negative_marking`,
    [enabled]
  );
  return row?.negative_marking ?? enabled;
}

/** Seconds a pen & paper question gets (see lib/questionTiming.ts). */
export async function getPenPaperSeconds(): Promise<number> {
  const row = await queryOne<{ pen_paper_seconds: number }>("SELECT pen_paper_seconds FROM game_settings LIMIT 1");
  return row?.pen_paper_seconds ?? PEN_PAPER_DEFAULT_SECONDS;
}

export async function setPenPaperSeconds(seconds: number): Promise<number> {
  const row = await queryOne<{ pen_paper_seconds: number }>(
    `INSERT INTO game_settings (id, pen_paper_seconds) VALUES (true, $1)
     ON CONFLICT (id) DO UPDATE SET pen_paper_seconds = $1
     RETURNING pen_paper_seconds`,
    [seconds]
  );
  return row?.pen_paper_seconds ?? seconds;
}
