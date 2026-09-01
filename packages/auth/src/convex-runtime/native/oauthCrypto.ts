import { base64urlToBytes, bytesToBase64url } from "./password.js";
import type { OAuthToken } from "./oauth.js";

const ENCRYPTION_SALT = new TextEncoder().encode("convex-better-auth-2.0");
const ENCRYPTION_INFO = new TextEncoder().encode("oauth-account-tokens");
const AES_GCM_IV_BYTES = 12;

export type EncryptedOAuthToken = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scopes?: string[];
};

let cachedKey: ArrayBuffer | undefined;

export async function getOAuthTokenEncryptionKey(): Promise<ArrayBuffer> {
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
  cachedKey = bits;
  return cachedKey;
}

export async function encryptAccountToken(plaintext: string): Promise<string> {
  const keyData = await getOAuthTokenEncryptionKey();
  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", keyData, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encoder = new TextEncoder();
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64url(combined);
}

export async function decryptAccountToken(ciphertext: string): Promise<string> {
  const keyData = await getOAuthTokenEncryptionKey();
  const cryptoKey = await globalThis.crypto.subtle.importKey("raw", keyData, "AES-GCM", false, [
    "decrypt",
  ]);
  const combined = base64urlToBytes(ciphertext);
  const iv = combined.slice(0, AES_GCM_IV_BYTES);
  const encrypted = combined.slice(AES_GCM_IV_BYTES);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encrypted,
  );
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
