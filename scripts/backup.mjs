// Dumps every table, encrypts the dump, and writes it to
// backup/<date>/backup-<time>.json.enc (relative to the repo root this
// script is run from) - the GitHub Actions workflow that calls this then
// commits that file straight into this same (public) repo. Deliberately
// dumps everything as-is, hashes and PII included - a backup missing the
// fields needed to actually restore isn't much of a backup - but it's
// encrypted before it ever touches disk, so what lands in the public repo
// is unreadable without BACKUP_ENCRYPTION_KEY. See lib/backupEncryption.ts
// (the app's copy of this same scheme) and docs/SETUP.md.
import { Pool } from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, randomBytes } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const rawKey = process.env.BACKUP_ENCRYPTION_KEY;
if (!rawKey) {
  console.error("BACKUP_ENCRYPTION_KEY is not set.");
  process.exit(1);
}
const key = Buffer.from(rawKey, "base64");
if (key.length !== 32) {
  console.error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes - generate with: openssl rand -base64 32");
  process.exit(1);
}

// Keep in sync with lib/backupTables.ts - duplicated here since this script
// runs standalone (no Next.js build step) and can't import that TS file.
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

function encrypt(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const tables = {};
  const rowCounts = {};
  for (const table of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
    tables[table] = rows;
    rowCounts[table] = rows.length;
  }
  await pool.end();

  const backedUpAt = new Date();
  const payload = JSON.stringify(
    { manifest: { backedUpAt: backedUpAt.toISOString(), rowCounts, trigger: "scheduled" }, tables },
    null,
    2
  );
  const encrypted = encrypt(payload);

  const dateKey = backedUpAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeKey = backedUpAt.toISOString().slice(11, 19).replace(/:/g, ""); // HHMMSS
  const outDir = path.join("backup", dateKey);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `backup-${timeKey}.json.enc`);
  await writeFile(outPath, encrypted);

  console.log("Backup complete:", outPath, rowCounts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
