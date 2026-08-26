export const AUTH_MD_SERVICE_AUTH_DEFAULT_EXPIRES_IN_SECONDS = 900 as const;
export const AUTH_MD_SERVICE_AUTH_DEFAULT_USER_CODE_EXPIRES_IN_SECONDS = 600 as const;
export const AUTH_MD_SERVICE_AUTH_DEFAULT_INTERVAL_SECONDS = 5 as const;

const CLAIM_TOKEN_BYTES = 32;
const CLAIM_VIEW_TOKEN_BYTES = 32;
const USER_CODE_LENGTH = 6;

export type AuthMdServiceAuthChallenge = {
  claimToken: string;
  claimTokenHash: string;
  claimViewToken: string;
  claimViewTokenHash: string;
  userCode: string;
  userCodeHash: string;
  expiresAt: number;
  userCodeExpiresAt: number;
  expiresIn: number;
  userCodeExpiresIn: number;
  interval: number;
};

export async function createAuthMdServiceAuthChallenge(options?: {
  now?: number;
  expiresIn?: number;
  userCodeExpiresIn?: number;
  interval?: number;
  randomBytes?: (length: number) => Uint8Array;
}): Promise<AuthMdServiceAuthChallenge> {
  const now = options?.now ?? Date.now();
  const expiresIn = options?.expiresIn ?? AUTH_MD_SERVICE_AUTH_DEFAULT_EXPIRES_IN_SECONDS;
  const userCodeExpiresIn =
    options?.userCodeExpiresIn ?? AUTH_MD_SERVICE_AUTH_DEFAULT_USER_CODE_EXPIRES_IN_SECONDS;
  const interval = options?.interval ?? AUTH_MD_SERVICE_AUTH_DEFAULT_INTERVAL_SECONDS;
  requireNonnegativeSafeInteger(now, "now");
  requireBoundedPositiveInteger(expiresIn, "expiresIn", 15 * 60);
  requireBoundedPositiveInteger(
    userCodeExpiresIn,
    "userCodeExpiresIn",
    Math.min(expiresIn, 10 * 60),
  );
  requireBoundedPositiveInteger(interval, "interval", 60);
  const randomBytes = options?.randomBytes ?? secureRandomBytes;
  const claimToken = `clm_${bytesToBase64Url(
    requireEntropy(randomBytes(CLAIM_TOKEN_BYTES), CLAIM_TOKEN_BYTES),
  )}`;
  const claimViewToken = `cvt_${bytesToBase64Url(
    requireEntropy(randomBytes(CLAIM_VIEW_TOKEN_BYTES), CLAIM_VIEW_TOKEN_BYTES),
  )}`;
  const userCode = generateUserCode(randomBytes);
  const [claimTokenHash, claimViewTokenHash, userCodeHash] = await Promise.all([
    hashAuthMdSecret(claimToken),
    hashAuthMdSecret(claimViewToken),
    hashAuthMdSecret(normalizeAuthMdUserCode(userCode)),
  ]);
  return {
    claimToken,
    claimTokenHash,
    claimViewToken,
    claimViewTokenHash,
    userCode,
    userCodeHash,
    expiresAt: now + expiresIn * 1000,
    userCodeExpiresAt: now + userCodeExpiresIn * 1000,
    expiresIn,
    userCodeExpiresIn,
    interval,
  };
}

export function normalizeAuthMdLoginHint(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    throw new TypeError("auth.md service_auth login_hint must be an email");
  }
  return normalized;
}

export function normalizeAuthMdUserCode(value: string): string {
  const normalized = value.replaceAll(/[\s-]/gu, "");
  if (!/^\d{6}$/u.test(normalized)) {
    throw new TypeError("auth.md service_auth user_code must contain six digits");
  }
  return normalized;
}

export async function hashAuthMdLoginHint(value: string): Promise<string> {
  return await hashAuthMdSecret(normalizeAuthMdLoginHint(value));
}

export async function hashAuthMdUserCode(value: string): Promise<string> {
  return await hashAuthMdSecret(normalizeAuthMdUserCode(value));
}

export async function hashAuthMdSecret(value: string): Promise<string> {
  if (value.length === 0) {
    throw new TypeError("auth.md secret is required");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function generateUserCode(randomBytes: (length: number) => Uint8Array): string {
  const digits: string[] = [];
  while (digits.length < USER_CODE_LENGTH) {
    const entropy = randomBytes(USER_CODE_LENGTH * 2);
    if (entropy.length !== USER_CODE_LENGTH * 2) {
      throw new Error("auth.md service_auth entropy source is invalid");
    }
    for (const byte of entropy) {
      if (byte >= 250) continue;
      digits.push(String(byte % 10));
      if (digits.length === USER_CODE_LENGTH) break;
    }
  }
  return digits.join("");
}

function requireEntropy(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length !== length) {
    throw new Error("auth.md service_auth entropy source is invalid");
  }
  return bytes;
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
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
