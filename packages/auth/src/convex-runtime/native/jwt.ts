import {
  type JWTPayload,
  type JSONWebKeySet,
  SignJWT,
  createLocalJWKSet,
  importJWK,
  jwtVerify,
} from "jose";

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

export async function mintToken(
  sub: string,
  sessionId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const key = await getJwtPrivateKey();
  return await new SignJWT({ sessionId, ...extra })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const jwks = createLocalJWKSet(getJwks());
  const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256"] });
  return payload;
}
