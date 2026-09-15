import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Kid PINs are short (4 digits) by design - they need to be easy for a
// 9-year-old to type. Short PINs are brute-forceable if an attacker can hit
// the endpoint unlimited times, so the login route (app/api/auth/kid-login)
// rate-limits attempts per child per IP on top of this hash. This is not
// bank-grade auth; it doesn't need to be for a family reward tracker, but the
// hashing + rate limit together mean a PIN is never stored or guessable in
// plain text.

const KEY_LEN = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, salt, KEY_LEN);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
