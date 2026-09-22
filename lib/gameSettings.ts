import "server-only";
import { queryOne } from "@/lib/db";

/** Family-wide, admin-toggleable game settings - currently just whether a
 * wrong answer docks a child half the points a correct one would have
 * earned. See app/api/admin/settings/route.ts and
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
