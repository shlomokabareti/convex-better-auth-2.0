import { base64urlToBytes, bytesToBase64url } from "../convex-runtime/native/password.js";

export const AGENT_AUTH_DEVICE_AUTHORIZATION_GRANT_TYPE =
  "urn:ietf:params:oauth:grant-type:device_code" as const;
export const AGENT_AUTH_DEVICE_AUTHORIZATION_DEFAULT_EXPIRES_IN_SECONDS = 600 as const;
export const AGENT_AUTH_DEVICE_AUTHORIZATION_DEFAULT_INTERVAL_SECONDS = 5 as const;

const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
const USER_CODE_LENGTH = 8;
const DEVICE_CODE_BYTES = 32;

export type AgentAuthDeviceAuthorizationChallenge = {
  deviceCode: string;
  deviceCodeHash: string;
  userCode: string;
  userCodeHash: string;
  expiresAt: number;
  expiresIn: number;
  interval: number;
};

export async function createAgentAuthDeviceAuthorizationChallenge(options?: {
  now?: number;
  expiresIn?: number;
  interval?: number;
  randomBytes?: (length: number) => Uint8Array;
}): Promise<AgentAuthDeviceAuthorizationChallenge> {
  const now = options?.now ?? Date.now();
  const expiresIn =
    options?.expiresIn ?? AGENT_AUTH_DEVICE_AUTHORIZATION_DEFAULT_EXPIRES_IN_SECONDS;
  const interval = options?.interval ?? AGENT_AUTH_DEVICE_AUTHORIZATION_DEFAULT_INTERVAL_SECONDS;
  requireNonnegativeSafeInteger(now, "now");
  requireBoundedPositiveInteger(expiresIn, "expiresIn", 15 * 60);
  requireBoundedPositiveInteger(interval, "interval", 60);
  const randomBytes = options?.randomBytes ?? secureRandomBytes;
  const userCode = formatUserCode(generateUserCode(randomBytes));
  const deviceCode = bytesToBase64Url(randomBytes(DEVICE_CODE_BYTES));
  if (decodeBase64Url(deviceCode).length !== DEVICE_CODE_BYTES) {
    throw new Error("Device authorization entropy source is invalid");
  }
  const [userCodeHash, deviceCodeHash] = await Promise.all([
    hashAgentAuthDeviceAuthorizationCode(normalizeAgentAuthUserCode(userCode)),
    hashAgentAuthDeviceAuthorizationCode(deviceCode),
  ]);
  return {
    deviceCode,
    deviceCodeHash,
    userCode,
    userCodeHash,
    expiresAt: now + expiresIn * 1000,
    expiresIn,
    interval,
  };
}

export function normalizeAgentAuthUserCode(value: string): string {
  const normalized = value.toUpperCase().replaceAll(/[\s-]/gu, "");
  if (normalized.length !== USER_CODE_LENGTH || !/^[BCDFGHJKLMNPQRSTVWXZ]{8}$/u.test(normalized)) {
    throw new TypeError("Agent Auth user code is invalid");
  }
  return normalized;
}

export async function hashAgentAuthDeviceAuthorizationCode(value: string): Promise<string> {
  if (value.length === 0) {
    throw new TypeError("Device authorization code is required");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function generateUserCode(randomBytes: (length: number) => Uint8Array): string {
  const characters: string[] = [];
  while (characters.length < USER_CODE_LENGTH) {
    const entropy = randomBytes(USER_CODE_LENGTH * 2);
    if (entropy.length !== USER_CODE_LENGTH * 2) {
      throw new Error("Device authorization entropy source is invalid");
    }
    for (const byte of entropy) {
      if (byte >= 240) continue;
      const character = USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
      if (character !== undefined) characters.push(character);
      if (characters.length === USER_CODE_LENGTH) break;
    }
  }
  return characters.join("");
}

function formatUserCode(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64url(bytes);
}

function decodeBase64Url(value: string): Uint8Array {
  return base64urlToBytes(value);
}

function requireNonnegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a nonnegative safe integer`);
  }
}

function requireBoundedPositiveInteger(value: number, name: string, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError(`${name} must be an integer between 1 and ${maximum}`);
  }
}
