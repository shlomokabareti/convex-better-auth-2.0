import { type JWTPayload, type JSONWebKeySet, SignJWT, importJWK } from "jose";

let cachedPrivateKey: CryptoKey | undefined;
let cachedJwks: JSONWebKeySet | undefined;

export async function getJwtPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const raw = process.env.JWT_PRIVATE_KEY;
  if (!raw) {
    throw new Error("JWT_PRIVATE_KEY environment variable is not set");
  }
  const jwk = JSON.parse(raw) as JsonWebKey;
  const keyLike = await importJWK(jwk, "RS256");
  if (keyLike instanceof Uint8Array) {
    throw new Error("JWT_PRIVATE_KEY must be an asymmetric key, not a symmetric secret");
  }
  cachedPrivateKey = keyLike;
  return cachedPrivateKey;
}

export function getJwks(): JSONWebKeySet {
  if (cachedJwks) return cachedJwks;
  const raw = process.env.JWKS;
  if (!raw) {
    throw new Error("JWKS environment variable is not set");
  }
  cachedJwks = JSON.parse(raw) as JSONWebKeySet;
  return cachedJwks;
}

const DEFAULT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function mintToken(
  sub: string,
  sessionId: string,
  extra: Record<string, unknown> = {},
  options: { expiresInSeconds?: number } = {},
): Promise<string> {
  const key = await getJwtPrivateKey();
  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
  const exp = new Date(Date.now() + expiresInSeconds * 1000);
  return await new SignJWT({ sessionId, ...extra })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

function base64UrlToBase64(value: string): string {
  return value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
}

function base64UrlToString(value: string): string {
  return atob(base64UrlToBase64(value));
}

function base64UrlToBytes(value: string): Uint8Array {
  const binary = atob(base64UrlToBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

type JwtHeader = {
  alg: string;
  typ?: string;
  kid?: string;
};

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false,
    ["verify"],
  );
}

function findPublicKey(jwks: JSONWebKeySet, kid?: string): JsonWebKey | undefined {
  if (kid) {
    return jwks.keys.find((k) => k.kid === kid);
  }
  return jwks.keys[0];
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected three segments");
  }

  const [h64, p64, s64] = parts;
  if (!h64 || !p64 || !s64) {
    throw new Error("Invalid JWT: missing segment");
  }

  let header: JwtHeader;
  let payload: JWTPayload;
  try {
    header = JSON.parse(base64UrlToString(h64)) as JwtHeader;
    payload = JSON.parse(base64UrlToString(p64)) as JWTPayload;
  } catch {
    throw new Error("Invalid JWT: malformed header or payload");
  }

  if (header.alg !== "RS256") {
    throw new Error(`Invalid JWT: unsupported algorithm ${header.alg ?? "none"}`);
  }

  const jwks = getJwks();
  const jwk = findPublicKey(jwks, header.kid);
  if (!jwk) {
    throw new Error("Invalid JWT: no matching public key");
  }

  const key = await importPublicKey(jwk);
  const data = new TextEncoder().encode(`${h64}.${p64}`);
  const signature = arrayBufferFromBytes(base64UrlToBytes(s64));
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!valid) {
    throw new Error("Invalid JWT: signature verification failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && typeof payload.exp === "number" && now > payload.exp) {
    throw new Error("Invalid JWT: token expired");
  }
  if (payload.nbf !== undefined && typeof payload.nbf === "number" && now < payload.nbf) {
    throw new Error("Invalid JWT: token not yet valid");
  }
  if (payload.iat !== undefined && typeof payload.iat === "number" && now < payload.iat - 60) {
    throw new Error("Invalid JWT: issued in the future");
  }

  return payload;
}
