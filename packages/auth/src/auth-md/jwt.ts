import {
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";

export const AUTH_MD_SIGNING_ALGORITHM = "ES256" as const;
export const AUTH_MD_IDENTITY_ASSERTION_TYPE = "oauth-id-jag+jwt" as const;
export const AUTH_MD_ACCESS_TOKEN_TYPE = "at+jwt" as const;
export const AUTH_MD_MAX_ASSERTION_LIFETIME_SECONDS = 24 * 60 * 60;
export const AUTH_MD_MAX_ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;

export type AuthMdSigningKeyRecord = {
  keyId: string;
  algorithm: typeof AUTH_MD_SIGNING_ALGORITHM;
  publicJwkJson: string;
  privateJwkJson: string;
};

export type AuthMdIdentityAssertionClaims = {
  assertionId: string;
  registrationId: string;
  userId: string;
  organizationId: string;
  resource: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
};

export type AuthMdAccessTokenClaims = {
  credentialId: string;
  registrationId: string;
  userId: string;
  organizationId: string;
  resource: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
};

export async function signAuthMdIdentityAssertion(args: {
  signingKey: AuthMdSigningKeyRecord;
  issuer: string;
  claims: AuthMdIdentityAssertionClaims;
}): Promise<string> {
  requireSigningKey(args.signingKey);
  const issuer = requireHttpsIssuer(args.issuer);
  const claims = validateIdentityAssertionClaims(args.claims);
  const privateKey = await importJWK(
    parseJwk(args.signingKey.privateJwkJson),
    AUTH_MD_SIGNING_ALGORITHM
  );
  return await new SignJWT({
    registration_type: "service_auth",
    assertion_id: claims.assertionId,
    user_id: claims.userId,
    org_id: claims.organizationId,
    resource: claims.resource,
    scope: claims.scopes.join(" "),
  })
    .setProtectedHeader({
      alg: AUTH_MD_SIGNING_ALGORITHM,
      kid: args.signingKey.keyId,
      typ: AUTH_MD_IDENTITY_ASSERTION_TYPE,
    })
    .setIssuer(issuer)
    .setSubject(claims.registrationId)
    .setAudience(issuer)
    .setJti(claims.assertionId)
    .setIssuedAt(claims.issuedAt)
    .setExpirationTime(claims.expiresAt)
    .sign(privateKey);
}

export async function verifyAuthMdIdentityAssertion(args: {
  assertion: string;
  signingKeys: readonly AuthMdSigningKeyRecord[];
  issuer: string;
  now?: number;
}): Promise<AuthMdIdentityAssertionClaims> {
  const issuer = requireHttpsIssuer(args.issuer);
  const key = resolveVerificationKey(
    args.assertion,
    args.signingKeys,
    AUTH_MD_IDENTITY_ASSERTION_TYPE
  );
  const publicKey = await importJWK(
    parseJwk(key.publicJwkJson),
    AUTH_MD_SIGNING_ALGORITHM
  );
  const { payload } = await jwtVerify(args.assertion, publicKey, {
    algorithms: [AUTH_MD_SIGNING_ALGORITHM],
    issuer,
    audience: issuer,
    currentDate: optionalCurrentDate(args.now),
  });
  return parseIdentityAssertionPayload(payload);
}

export async function signAuthMdAccessToken(args: {
  signingKey: AuthMdSigningKeyRecord;
  issuer: string;
  claims: AuthMdAccessTokenClaims;
}): Promise<string> {
  requireSigningKey(args.signingKey);
  const issuer = requireHttpsIssuer(args.issuer);
  const claims = validateAccessTokenClaims(args.claims);
  const privateKey = await importJWK(
    parseJwk(args.signingKey.privateJwkJson),
    AUTH_MD_SIGNING_ALGORITHM
  );
  return await new SignJWT({
    registration_id: claims.registrationId,
    org_id: claims.organizationId,
    resource: claims.resource,
    scope: claims.scopes.join(" "),
  })
    .setProtectedHeader({
      alg: AUTH_MD_SIGNING_ALGORITHM,
      kid: args.signingKey.keyId,
      typ: AUTH_MD_ACCESS_TOKEN_TYPE,
    })
    .setIssuer(issuer)
    .setSubject(claims.userId)
    .setAudience(claims.resource)
    .setJti(claims.credentialId)
    .setIssuedAt(claims.issuedAt)
    .setExpirationTime(claims.expiresAt)
    .sign(privateKey);
}

export async function verifyAuthMdAccessToken(args: {
  accessToken: string;
  signingKeys: readonly AuthMdSigningKeyRecord[];
  issuer: string;
  resource: string;
  now?: number;
}): Promise<AuthMdAccessTokenClaims> {
  const issuer = requireHttpsIssuer(args.issuer);
  const resource = requireHttpsResource(args.resource);
  const key = resolveVerificationKey(
    args.accessToken,
    args.signingKeys,
    AUTH_MD_ACCESS_TOKEN_TYPE
  );
  const publicKey = await importJWK(
    parseJwk(key.publicJwkJson),
    AUTH_MD_SIGNING_ALGORITHM
  );
  const { payload } = await jwtVerify(args.accessToken, publicKey, {
    algorithms: [AUTH_MD_SIGNING_ALGORITHM],
    issuer,
    audience: resource,
    currentDate: optionalCurrentDate(args.now),
  });
  const claims = parseAccessTokenPayload(payload);
  if (claims.resource !== resource) {
    throw new Error("auth.md access token resource does not match audience");
  }
  return claims;
}

function parseIdentityAssertionPayload(
  payload: JWTPayload
): AuthMdIdentityAssertionClaims {
  if (payload.registration_type !== "service_auth") {
    throw new Error("auth.md identity assertion registration type is invalid");
  }
  const claims = {
    assertionId: requireMatchingJti(payload, "assertion_id"),
    registrationId: requireClaimString(payload, "sub"),
    userId: requireClaimString(payload, "user_id"),
    organizationId: requireClaimString(payload, "org_id"),
    resource: requireHttpsResource(requireClaimString(payload, "resource")),
    scopes: parseScope(payload.scope),
    issuedAt: requireClaimInteger(payload, "iat"),
    expiresAt: requireClaimInteger(payload, "exp"),
  };
  return validateIdentityAssertionClaims(claims);
}

function parseAccessTokenPayload(payload: JWTPayload): AuthMdAccessTokenClaims {
  const claims = {
    credentialId: requireClaimString(payload, "jti"),
    registrationId: requireClaimString(payload, "registration_id"),
    userId: requireClaimString(payload, "sub"),
    organizationId: requireClaimString(payload, "org_id"),
    resource: requireHttpsResource(requireClaimString(payload, "resource")),
    scopes: parseScope(payload.scope),
    issuedAt: requireClaimInteger(payload, "iat"),
    expiresAt: requireClaimInteger(payload, "exp"),
  };
  return validateAccessTokenClaims(claims);
}

function validateIdentityAssertionClaims(
  claims: AuthMdIdentityAssertionClaims
): AuthMdIdentityAssertionClaims {
  requireIdentifier(claims.assertionId, "assertionId");
  requireIdentifier(claims.registrationId, "registrationId");
  requireIdentifier(claims.userId, "userId");
  requireIdentifier(claims.organizationId, "organizationId");
  requireHttpsResource(claims.resource);
  requireScopes(claims.scopes);
  requireLifetime(
    claims.issuedAt,
    claims.expiresAt,
    AUTH_MD_MAX_ASSERTION_LIFETIME_SECONDS,
    "identity assertion"
  );
  return claims;
}

function validateAccessTokenClaims(
  claims: AuthMdAccessTokenClaims
): AuthMdAccessTokenClaims {
  requireIdentifier(claims.credentialId, "credentialId");
  requireIdentifier(claims.registrationId, "registrationId");
  requireIdentifier(claims.userId, "userId");
  requireIdentifier(claims.organizationId, "organizationId");
  requireHttpsResource(claims.resource);
  requireScopes(claims.scopes);
  requireLifetime(
    claims.issuedAt,
    claims.expiresAt,
    AUTH_MD_MAX_ACCESS_TOKEN_LIFETIME_SECONDS,
    "access token"
  );
  return claims;
}

function resolveVerificationKey(
  token: string,
  keys: readonly AuthMdSigningKeyRecord[],
  expectedType: string
): AuthMdSigningKeyRecord {
  const header = decodeProtectedHeader(token);
  if (
    header.alg !== AUTH_MD_SIGNING_ALGORITHM ||
    header.typ !== expectedType ||
    typeof header.kid !== "string"
  ) {
    throw new Error("auth.md JWT protected header is invalid");
  }
  const key = keys.find((candidate) => candidate.keyId === header.kid);
  if (key === undefined) {
    throw new Error("auth.md JWT signing key was not found");
  }
  requireSigningKey(key);
  return key;
}

function requireSigningKey(key: AuthMdSigningKeyRecord): void {
  requireIdentifier(key.keyId, "signing key id");
  if (key.algorithm !== AUTH_MD_SIGNING_ALGORITHM) {
    throw new Error("auth.md signing key algorithm must be ES256");
  }
}

function parseJwk(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("auth.md signing key must be a JSON object");
  }
  return Object.fromEntries(Object.entries(parsed));
}

function requireMatchingJti(payload: JWTPayload, claim: string): string {
  const jti = requireClaimString(payload, "jti");
  if (requireClaimString(payload, claim) !== jti) {
    throw new Error(`auth.md ${claim} must match jti`);
  }
  return jti;
}

function requireClaimString(payload: JWTPayload, claim: string): string {
  const value = Reflect.get(payload, claim);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`auth.md JWT ${claim} claim is required`);
  }
  return value;
}

function requireClaimInteger(payload: JWTPayload, claim: string): number {
  const value = Reflect.get(payload, claim);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`auth.md JWT ${claim} claim must be an integer`);
  }
  return value;
}

function parseScope(value: unknown): string[] {
  if (typeof value !== "string") {
    throw new Error("auth.md JWT scope claim is required");
  }
  return requireScopes(value.split(" ").filter((scope) => scope.length > 0));
}

function requireScopes(scopes: readonly string[]): string[] {
  if (
    scopes.length === 0 ||
    scopes.some((scope) => scope.length === 0 || /\s/u.test(scope)) ||
    new Set(scopes).size !== scopes.length
  ) {
    throw new TypeError("auth.md scopes are invalid");
  }
  return [...scopes].toSorted();
}

function requireLifetime(
  issuedAt: number,
  expiresAt: number,
  maximumSeconds: number,
  label: string
): void {
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt < 0 ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > maximumSeconds
  ) {
    throw new TypeError(`auth.md ${label} lifetime is invalid`);
  }
}

function requireIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 512) {
    throw new TypeError(`auth.md ${label} is invalid`);
  }
  return normalized;
}

function requireHttpsIssuer(value: string): string {
  const issuer = requireHttpsResource(value);
  const parsed = new URL(issuer);
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new TypeError("auth.md issuer must not contain query or fragment");
  }
  return issuer.endsWith("/") ? issuer.slice(0, -1) : issuer;
}

function requireHttpsResource(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("auth.md resource must be an absolute URL");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new TypeError("auth.md resource must be a clean HTTPS URL");
  }
  return parsed.toString();
}

function optionalCurrentDate(now: number | undefined): Date | undefined {
  if (now === undefined) return undefined;
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError("auth.md verification time is invalid");
  }
  return new Date(now);
}
