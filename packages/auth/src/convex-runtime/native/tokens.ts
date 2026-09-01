const TOKEN_BYTES = 32;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
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

export function generateVerificationToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return bytesToHex(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function isTokenExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export async function verifyTokenHash(token: string, tokenHash: string): Promise<boolean> {
  const actual = await hashToken(token);
  if (tokenHash.length !== actual.length) {
    return false;
  }
  const expectedBytes = hexToBytes(tokenHash);
  const actualBytes = hexToBytes(actual);
  return timingSafeEqual(expectedBytes, actualBytes);
}
