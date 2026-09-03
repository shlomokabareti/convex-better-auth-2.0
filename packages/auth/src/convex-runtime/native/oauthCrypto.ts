import { CompactEncrypt, compactDecrypt } from "jose";
import type { OAuthToken } from "./oauth.js";

const ENCRYPTION_SALT = new TextEncoder().encode("convex-auth-2.0");
const ENCRYPTION_INFO = new TextEncoder().encode("oauth-account-tokens");

export type EncryptedOAuthToken = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scopes?: string[];
};

let cachedKey: Uint8Array | undefined;

export async function getOAuthTokenEncryptionKey(): Promise<Uint8Array> {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY ?? process.env.JWT_PRIVATE_KEY;
  if (!secret) {
    throw new Error(
      "Missing OAUTH_TOKEN_ENCRYPTION_KEY or JWT_PRIVATE_KEY. " +
        "Set OAUTH_TOKEN_ENCRYPTION_KEY for OAuth provider-token encryption.",
    );
  }

  const encoder = new TextEncoder();
  const ikm = encoder.encode(secret);
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    ikm.buffer as ArrayBuffer,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: ENCRYPTION_SALT,
      info: ENCRYPTION_INFO,
    },
    baseKey,
    256,
  );
  cachedKey = new Uint8Array(bits);
  return cachedKey;
}

export async function encryptAccountToken(plaintext: string): Promise<string> {
  const key = await getOAuthTokenEncryptionKey();
  return await new CompactEncrypt(new TextEncoder().encode(plaintext))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

export async function decryptAccountToken(ciphertext: string): Promise<string> {
  const key = await getOAuthTokenEncryptionKey();
  const { plaintext } = await compactDecrypt(ciphertext, key);
  return new TextDecoder().decode(plaintext);
}

export async function encryptOAuthTokens(tokens: OAuthToken): Promise<EncryptedOAuthToken> {
  const [accessToken, refreshToken, idToken] = await Promise.all([
    encryptAccountToken(tokens.accessToken),
    tokens.refreshToken ? encryptAccountToken(tokens.refreshToken) : Promise.resolve(undefined),
    tokens.idToken ? encryptAccountToken(tokens.idToken) : Promise.resolve(undefined),
  ]);
  return {
    accessToken,
    refreshToken,
    idToken,
    tokenType: tokens.tokenType,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
  };
}
