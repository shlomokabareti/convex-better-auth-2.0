const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ALGORITHM = "SHA-1";

export function generateSecret(bytes = 20): Uint8Array {
  const buffer = new Uint8Array(bytes);
  return globalThis.crypto.getRandomValues(buffer);
}

export type TOTPConfig = {
  digits?: number;
  period?: number;
  algorithm?: "SHA-1" | "SHA-256" | "SHA-512";
  issuer?: string;
  label?: string;
};

export function encodeBase32(bytes: Uint8Array): string {
  let bits = "";
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, "0");
  }
  let result = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    result += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return result;
}

export function decodeBase32(input: string): Uint8Array {
  const sanitized = input
    .toUpperCase()
    .replace(/=/g, "")
    .split("")
    .filter((c) => BASE32_ALPHABET.includes(c))
    .join("");
  let bits = "";
  for (const c of sanitized) {
    bits += BASE32_ALPHABET.indexOf(c).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export async function generateTOTPSecret(size = 20): Promise<Uint8Array> {
  return globalThis.crypto.getRandomValues(new Uint8Array(size));
}

function bufferFromUint8(data: Uint8Array): ArrayBuffer {
  return data.buffer as ArrayBuffer;
}

function numberToUint8Buffer(value: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(value), false);
  return buffer;
}

export async function generateTOTP(
  secret: Uint8Array,
  counter: number,
  config: TOTPConfig = {},
): Promise<string> {
  const digits = config.digits ?? DEFAULT_DIGITS;
  const algorithm = config.algorithm ?? DEFAULT_ALGORITHM;

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    bufferFromUint8(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );

  const counterBuffer = numberToUint8Buffer(counter);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    counterBuffer,
  );
  const h = new Uint8Array(signature);

  const offset = h[h.length - 1] & 0x0f;
  const code =
    (((h[offset] & 0x7f) << 24) |
      ((h[offset + 1] & 0xff) << 16) |
      ((h[offset + 2] & 0xff) << 8) |
      (h[offset + 3] & 0xff)) %
    Math.pow(10, digits);

  return code.toString().padStart(digits, "0");
}

export function getCurrentTOTPCounter(period = DEFAULT_PERIOD, now = Date.now()): number {
  return Math.floor(now / 1000 / period);
}

export async function getCurrentTOTP(
  secret: Uint8Array,
  config: TOTPConfig = {},
  now = Date.now(),
): Promise<string> {
  const period = config.period ?? DEFAULT_PERIOD;
  const counter = getCurrentTOTPCounter(period, now);
  return generateTOTP(secret, counter, config);
}

export async function verifyTOTP(
  secret: Uint8Array,
  code: string,
  config: TOTPConfig = {},
  window = 1,
  now = Date.now(),
): Promise<boolean> {
  const period = config.period ?? DEFAULT_PERIOD;
  const digits = config.digits ?? DEFAULT_DIGITS;
  if (code.length !== digits || /[^0-9]/.test(code)) {
    return false;
  }
  const currentCounter = getCurrentTOTPCounter(period, now);
  for (let delta = -window; delta <= window; delta++) {
    const expected = await generateTOTP(secret, currentCounter + delta, config);
    if (expected === code) {
      return true;
    }
  }
  return false;
}

export function buildTOTPURI(secret: string, config: TOTPConfig = {}): string {
  const issuer = config.issuer ?? "Convex";
  const label = config.label ?? "user";
  const algorithm = config.algorithm ?? DEFAULT_ALGORITHM;
  const digits = config.digits ?? DEFAULT_DIGITS;
  const period = config.period ?? DEFAULT_PERIOD;

  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.replace("-", "").toUpperCase(),
    digits: digits.toString(),
    period: period.toString(),
  });

  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(label);
  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?${params.toString()}`;
}
