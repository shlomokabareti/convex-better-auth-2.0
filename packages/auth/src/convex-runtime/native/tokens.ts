"use node";
import { createHash, timingSafeEqual, webcrypto } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_ENCODING = "hex";

export function generateVerificationToken(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Buffer.from(bytes).toString(TOKEN_ENCODING);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest(TOKEN_ENCODING);
}

export function isTokenExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export function verifyTokenHash(token: string, tokenHash: string): boolean {
  const expected = Buffer.from(tokenHash, TOKEN_ENCODING);
  const actual = Buffer.from(hashToken(token), TOKEN_ENCODING);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
