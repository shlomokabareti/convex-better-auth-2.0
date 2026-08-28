import { argon2id, hash as argon2Hash, verify as argon2Verify } from "argon2";
import { scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "$scrypt$";

export async function hashPassword(password: string): Promise<string> {
  return await argon2Hash(password, { type: argon2id });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith(SCRYPT_PREFIX)) {
    const parts = hash.slice(SCRYPT_PREFIX.length).split("$");
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

  try {
    return await argon2Verify(hash, password);
  } catch {
    return false;
  }
}
