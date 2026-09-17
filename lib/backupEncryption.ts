import "server-only";
import { createCipheriv, randomBytes } from "crypto";

// AES-256-GCM under BACKUP_ENCRYPTION_KEY - a base64-encoded 32-byte key,
// generated once (`openssl rand -base64 32`) and set as the SAME value in
// both GitHub's repo secrets (for the daily automated backup) and Vercel's
// environment variables (for the admin-triggered one below). Nothing here
// can ever recover a lost key, and this repo is public - anyone who ever
// gets this key can read every backup ever committed - so it's kept only
// in those two secret stores plus wherever the household keeps it safe,
// never in the repo itself. See scripts/decryptBackup.mjs for the reverse
// operation, run locally with the same key.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) throw new Error("BACKUP_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes - generate with: openssl rand -base64 32");
  }
  return key;
}

/** Encrypts `plaintext` and returns a single base64 string: a random iv (12
 * bytes) + the GCM auth tag (16 bytes) + the ciphertext, all concatenated -
 * self-contained, nothing but the key itself is needed to decrypt it. */
export function encryptBackup(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}
