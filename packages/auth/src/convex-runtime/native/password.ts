import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "$scrypt$";

export function hashPassword(password: string): string {
  const salt = randomBytes(32);
  const derived = scryptSync(password, salt, 64);
  return `${PREFIX}${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash.startsWith(PREFIX)) {
    return false;
  }
  const parts = hash.slice(PREFIX.length).split("$");
  if (parts.length !== 2) {
    return false;
  }
  const [saltB64, derivedB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(derivedB64, "base64");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
