const PBKDF2_PREFIX = "$pbkdf2$";
const DEFAULT_ITERATIONS = 100_000;
const DEFAULT_KEYLEN = 32;
const DEFAULT_SALT_BYTES = 16;

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64url(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : -1;
    const bitmap = (b1 << 16) | (b2 === -1 ? 0 : b2 << 8) | (b3 === -1 ? 0 : b3);
    result += BASE64URL[(bitmap >> 18) & 63];
    result += BASE64URL[(bitmap >> 12) & 63];
    result += b2 === -1 ? "" : BASE64URL[(bitmap >> 6) & 63];
    result += b3 === -1 ? "" : BASE64URL[bitmap & 63];
  }
  return result;
}

export function base64urlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (normalized.length % 4)) % 4;
  const b64 = normalized + "=".repeat(pad);
  const map = new Map<string, number>();
  for (let i = 0; i < BASE64.length; i++) {
    map.set(BASE64[i], i);
  }
  const result: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const c1 = b64[i] === "=" ? -1 : (map.get(b64[i]) ?? -1);
    const c2 = b64[i + 1] === "=" ? -1 : (map.get(b64[i + 1]) ?? -1);
    const c3 = b64[i + 2] === "=" ? -1 : (map.get(b64[i + 2]) ?? -1);
    const c4 = b64[i + 3] === "=" ? -1 : (map.get(b64[i + 3]) ?? -1);
    if (c1 === -1 || c2 === -1) break;
    const bits =
      ((c1 & 63) << 18) |
      ((c2 & 63) << 12) |
      ((c3 === -1 ? 0 : c3 & 63) << 6) |
      (c4 === -1 ? 0 : c4 & 63);
    result.push((bits >> 16) & 255);
    if (c3 !== -1) result.push((bits >> 8) & 255);
    if (c4 !== -1) result.push(bits & 255);
  }
  return new Uint8Array(result);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keylen: number,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    keylen * 8,
  );
  return new Uint8Array(derived);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(DEFAULT_SALT_BYTES));
  const derived = await deriveKey(password, salt, DEFAULT_ITERATIONS, DEFAULT_KEYLEN);
  return `${PBKDF2_PREFIX}${DEFAULT_ITERATIONS}$${bytesToBase64url(salt)}$${bytesToBase64url(
    derived,
  )}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith(PBKDF2_PREFIX)) {
    return false;
  }

  const parts = hash.slice(PBKDF2_PREFIX.length).split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [iterationsStr, saltB64, derivedB64] = parts;
  const iterations = parseInt(iterationsStr, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  try {
    const salt = base64urlToBytes(saltB64);
    const expected = base64urlToBytes(derivedB64);
    const actual = await deriveKey(password, salt, iterations, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
