import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { Secret, TOTP } from "otpauth/bare";

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_ALGORITHM = "SHA-1";

const hashFns = {
  SHA1: sha1,
  SHA256: sha256,
  SHA512: sha512,
} as const;

export type TOTPAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

export type TOTPConfig = {
  digits?: number;
  period?: number;
  algorithm?: TOTPAlgorithm;
  issuer?: string;
  label?: string;
};

function canonicalAlgorithm(algorithm: string): keyof typeof hashFns {
  const normalized = algorithm.toUpperCase().replace(/-/g, "") as keyof typeof hashFns;
  if (!hashFns[normalized]) {
    throw new Error(`Unsupported TOTP algorithm: ${algorithm}`);
  }
  return normalized;
}

function hmacFunction(algorithm: string, key: Uint8Array, message: Uint8Array): Uint8Array {
  return hmac(hashFns[canonicalAlgorithm(algorithm)], key, message);
}

export function generateSecret(bytes = 20): Uint8Array {
  return new Secret({ size: bytes }).bytes;
}

export function encodeBase32(bytes: Uint8Array): string {
  return new Secret({ buffer: bytes.buffer }).base32;
}

export function decodeBase32(input: string): Uint8Array {
  return Secret.fromBase32(input).bytes;
}

function totpFromSecret(secret: Uint8Array | string, config: TOTPConfig = {}): TOTP {
  const algorithm = canonicalAlgorithm(config.algorithm ?? DEFAULT_ALGORITHM);
  const secretObj =
    typeof secret === "string" ? Secret.fromBase32(secret) : new Secret({ buffer: secret.buffer });
  return new TOTP({
    secret: secretObj,
    issuer: config.issuer ?? "Convex",
    label: config.label ?? "user",
    algorithm,
    digits: config.digits ?? DEFAULT_DIGITS,
    period: config.period ?? DEFAULT_PERIOD,
    hmac: hmacFunction,
  });
}

export async function generateTOTP(
  secret: Uint8Array,
  counter: number,
  config: TOTPConfig = {},
): Promise<string> {
  const period = config.period ?? DEFAULT_PERIOD;
  const totp = totpFromSecret(secret, config);
  return TOTP.generate({
    secret: totp.secret,
    algorithm: totp.algorithm,
    digits: totp.digits,
    period: totp.period,
    timestamp: counter * period * 1000,
    hmac: hmacFunction,
  });
}

export function getCurrentTOTPCounter(period = DEFAULT_PERIOD, now = Date.now()): number {
  return Math.floor(now / 1000 / period);
}

export async function verifyTOTP(
  secret: Uint8Array,
  code: string,
  config: TOTPConfig = {},
  window = 1,
  now = Date.now(),
): Promise<boolean> {
  const totp = totpFromSecret(secret, config);
  return (
    TOTP.validate({
      token: code,
      secret: totp.secret,
      algorithm: totp.algorithm,
      digits: totp.digits,
      period: totp.period,
      timestamp: now,
      window,
      hmac: hmacFunction,
    }) !== null
  );
}

export function buildTOTPURI(secret: string, config: TOTPConfig = {}): string {
  return totpFromSecret(secret, config).toString();
}
