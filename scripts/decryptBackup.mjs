// Decrypts a backup produced by scripts/backup.mjs or
// app/api/admin/backup/route.ts back into readable JSON.
//
// Usage:
//   BACKUP_ENCRYPTION_KEY=<your key> node scripts/decryptBackup.mjs backup/2026-09-18/backup-143200.json.enc
//
// Writes the decrypted JSON next to the input file, with .enc stripped from
// the name (so backup-143200.json.enc -> backup-143200.json). This is the
// ONLY way to read a backup once it's encrypted - if BACKUP_ENCRYPTION_KEY
// is ever lost, every backup ever committed is permanently unreadable.
import { readFile, writeFile } from "node:fs/promises";
import { createDecipheriv } from "node:crypto";

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: BACKUP_ENCRYPTION_KEY=<key> node scripts/decryptBackup.mjs <path-to-.enc-file>");
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

async function main() {
  const encoded = (await readFile(inPath, "utf8")).trim();
  const blob = Buffer.from(encoded, "base64");
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

  const outPath = inPath.endsWith(".enc") ? inPath.slice(0, -".enc".length) : `${inPath}.decrypted.json`;
  await writeFile(outPath, plaintext);
  console.log("Decrypted to", outPath);
}

main().catch((err) => {
  console.error("Decryption failed - wrong key, or a corrupted/truncated file.", err.message);
  process.exit(1);
});
