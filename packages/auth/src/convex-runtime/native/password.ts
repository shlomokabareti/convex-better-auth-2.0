import { base64url } from "jose";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";

const PBKDF2_PREFIX = "$pbkdf2$";
const SCRYPT_PREFIX = "$scrypt$";
const DEFAULT_SCRYPT_N = 2 ** 14;
const DEFAULT_SCRYPT_R = 8;
const DEFAULT_SCRYPT_P = 1;
const DEFAULT_DKLEN = 32;
const DEFAULT_SALT_BYTES = 16;
const DEFAULT_PBKDF2_ITERATIONS = 100_000;

export function bytesToBase64url(bytes: Uint8Array): string {
  return base64url.encode(bytes);
}

export function base64urlToBytes(value: string): Uint8Array {
  return base64url.decode(value);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(DEFAULT_SALT_BYTES));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derived = await scryptAsync(password, salt, {
    N: DEFAULT_SCRYPT_N,
    r: DEFAULT_SCRYPT_R,
    p: DEFAULT_SCRYPT_P,
    dkLen: DEFAULT_DKLEN,
  });
  const params = `N=${DEFAULT_SCRYPT_N},r=${DEFAULT_SCRYPT_R},p=${DEFAULT_SCRYPT_P}`;
  return `${SCRYPT_PREFIX}${params}$${bytesToBase64url(salt)}$${bytesToBase64url(derived)}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith(SCRYPT_PREFIX)) {
    return verifyScrypt(password, hash);
  }
  if (hash.startsWith(PBKDF2_PREFIX)) {
    return verifyPbkdf2(password, hash);
  }
  return false;
}

function parseScryptHash(hash: string): {
  salt: Uint8Array;
  expected: Uint8Array;
  N: number;
  r: number;
  p: number;
} | null {
  const parts = hash.slice(SCRYPT_PREFIX.length).split("$");
  if (parts.length !== 3) {
    return null;
  }
  const [params, saltB64, derivedB64] = parts;
  const opts: Record<string, number> = {};
  for (const pair of params.split(",")) {
    const [key, value] = pair.split("=");
    if (!key || !value) {
      return null;
    }
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    opts[key] = num;
  }
  const { N, r, p } = opts;
  if (typeof N !== "number" || typeof r !== "number" || typeof p !== "number") {
    return null;
  }
  try {
    const salt = base64urlToBytes(saltB64 ?? "");
    const expected = base64urlToBytes(derivedB64 ?? "");
    return { salt, expected, N, r, p };
  } catch {
    return null;
  }
}

async function verifyScrypt(password: string, hash: string): Promise<boolean> {
  const parsed = parseScryptHash(hash);
  if (!parsed) {
    return false;
  }
  const { salt, expected, N, r, p } = parsed;
  try {
    const actual = await scryptAsync(password, salt, {
      N,
      r,
      p,
      dkLen: expected.length,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function parsePbkdf2Hash(hash: string): {
  salt: Uint8Array;
  expected: Uint8Array;
  iterations: number;
} | null {
  const parts = hash.slice(PBKDF2_PREFIX.length).split("$");
  if (parts.length !== 3) {
    return null;
  }
  const [iterationsStr, saltB64, derivedB64] = parts;
  const iterations = parseInt(iterationsStr ?? "", 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return null;
  }
  try {
    const salt = base64urlToBytes(saltB64 ?? "");
    const expected = base64urlToBytes(derivedB64 ?? "");
    return { salt, expected, iterations };
  } catch {
    return null;
  }
}

function verifyPbkdf2(password: string, hash: string): boolean {
  const parsed = parsePbkdf2Hash(hash);
  if (!parsed) {
    return false;
  }
  const { salt, expected, iterations } = parsed;
  try {
    const actual = pbkdf2(sha256, password, salt, {
      c: iterations,
      dkLen: expected.length,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function legacyPbkdf2Hash(
  password: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
  saltBytes = DEFAULT_SALT_BYTES,
  dkLen = DEFAULT_DKLEN,
): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(saltBytes));
  const derived = pbkdf2(sha256, password, salt, { c: iterations, dkLen });
  return `${PBKDF2_PREFIX}${iterations}$${bytesToBase64url(salt)}$${bytesToBase64url(derived)}`;
}
