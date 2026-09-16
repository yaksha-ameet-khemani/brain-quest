// Dumps every table to a JSON file under OUT_DIR (default ./backup-output).
// Deliberately dumps everything as-is, hashes included - a backup that's
// missing the fields needed to actually restore isn't much of a backup, and
// the destination is a private repo the household controls, the same trust
// level as the production database itself. See docs/SETUP.md's "Automated
// backups" section for where OUT_DIR ends up and why this never runs
// against the app's own (public) repo.
import { Pool } from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const OUT_DIR = process.env.OUT_DIR || "./backup-output";

// Every table in db/schema.sql, in FK-safe order (not that order matters
// for a JSON dump, but it reads the same way the schema does).
const TABLES = [
  "parents",
  "children",
  "child_logins",
  "child_category_weights",
  "questions",
  "rounds",
  "round_questions",
  "point_transactions",
  "rewards",
  "redemptions",
];

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const summary = {};

  for (const table of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
    await writeFile(path.join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
  }

  await writeFile(
    path.join(OUT_DIR, "_manifest.json"),
    JSON.stringify({ backedUpAt: new Date().toISOString(), rowCounts: summary }, null, 2)
  );

  console.log("Backup complete:", summary);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
