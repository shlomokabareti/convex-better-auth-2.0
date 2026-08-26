import type { ApiTokenVerifier, VerifiedUserToken } from "convex-auth-core";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWK,
} from "jose";

import type { BetterAuthConvexAuthProvider } from "./createConvexAuthConfig";

export function assertWebhookHostIsDeliverable(hostname: string): void {
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host.length === 0) {
    throw new Error("Webhook endpoint URL must include a host");
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Webhook endpoint URL host is not deliverable");
  }
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    throw new Error("Webhook endpoint URL host is not deliverable");
  }
  if (host.startsWith("169.254.") || host === "metadata.google.internal") {
    throw new Error("Webhook endpoint URL host is not deliverable");
  }
}

export type BetterAuthApiTokenVerifierConfig = {
  issuer: string;
  audience?: string | string[];
} & (
  | {
      jwksUrl: string;
      jwks?: never;
    }
  | {
      jwksUrl?: never;
      jwks: {
        keys: JWK[];
      };
    }
);

function normalizeScopes(payload: JWTPayload): string[] {
  const scopeClaim = payload.scope;
  if (typeof scopeClaim === "string") {
    return scopeClaim
      .split(/\s+/u)
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
  }

  const scpClaim = payload.scp;
  if (Array.isArray(scpClaim)) {
    return scpClaim.filter(
      (scope): scope is string => typeof scope === "string"
    );
  }

  return [];
}

function normalizeAudience(payload: JWTPayload): string | null {
  const audience = payload.aud;
  if (typeof audience === "string") {
    return audience;
  }

  if (Array.isArray(audience)) {
    return (
      audience.find((entry): entry is string => typeof entry === "string") ??
      null
    );
  }

  return null;
}

function resolveSessionId(payload: JWTPayload): string | null {
  const sid = payload.sid;
  if (typeof sid === "string") {
    return sid;
  }

  const sessionId = payload.sessionId;
  if (typeof sessionId === "string") {
    return sessionId;
  }

  return null;
}

function createJwkResolver(config: BetterAuthApiTokenVerifierConfig) {
  if (config.jwksUrl !== undefined) {
    return createRemoteJWKSet(parseTrustedJwksUrl(config.jwksUrl));
  }

  return createLocalJWKSet(config.jwks);
}

/**
 * SSRF guard for the remote JWKS endpoint. `createRemoteJWKSet` fetches this URL
 * on the server; an attacker-or-misconfig-supplied `http://169.254.169.254/...`
 * or internal address would turn key resolution into an SSRF primitive. Require
 * HTTPS and reject internal/loopback/link-local/metadata hosts (reusing the same
 * host validator the webhook layer uses).
 */
function parseTrustedJwksUrl(jwksUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(jwksUrl);
  } catch {
    throw new Error("Better Auth jwksUrl is not a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Better Auth jwksUrl must use https.");
  }
  assertWebhookHostIsDeliverable(parsed.hostname);
  return parsed;
}

export function createBetterAuthApiTokenVerifier(
  config: BetterAuthApiTokenVerifierConfig
): ApiTokenVerifier {
  const jwkResolver = createJwkResolver(config);

  return {
    async verifyUserBearerToken(token: string): Promise<VerifiedUserToken> {
      const { payload } = await jwtVerify(token, jwkResolver, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ["RS256"],
      });

      if (typeof payload.sub !== "string") {
        throw new Error("Verified Better Auth token is missing subject.");
      }

      return {
        credentialType: "userBearer",
        provider: "better-auth",
        issuer: config.issuer,
        subject: payload.sub,
        tokenIdentifier: `${config.issuer}|${payload.sub}`,
        sessionId: resolveSessionId(payload),
        scopes: normalizeScopes(payload),
        audience: normalizeAudience(payload),
        rawClaims: payload satisfies Record<string, unknown>,
      };
    },
  };
}

export function createBetterAuthApiTokenVerifierFromConvexAuthConfig(
  provider: Pick<BetterAuthConvexAuthProvider, "issuer" | "jwks">,
  // `audience` is REQUIRED. Omitting it makes jose skip `aud` validation, so a
  // token minted for a DIFFERENT service sharing this issuer would verify here
  // (token confusion). Forcing the caller to name the audience closes that by
  // construction. Use the low-level createBetterAuthApiTokenVerifier directly if
  // you genuinely have a single-audience issuer and accept the risk.
  options: { audience: string | string[] }
): ApiTokenVerifier {
  if (
    options.audience === undefined ||
    (typeof options.audience === "string" && options.audience.length === 0) ||
    (Array.isArray(options.audience) && options.audience.length === 0)
  ) {
    throw new Error(
      "createBetterAuthApiTokenVerifierFromConvexAuthConfig: `audience` is required to prevent cross-service token confusion."
    );
  }
  if (provider.jwks.startsWith("data:")) {
    return createBetterAuthApiTokenVerifier({
      issuer: provider.issuer,
      audience: options.audience,
      jwks: decodeInlineJwksDataUrl(provider.jwks),
    });
  }

  return createBetterAuthApiTokenVerifier({
    issuer: provider.issuer,
    audience: options.audience,
    jwksUrl: provider.jwks,
  });
}

function decodeInlineJwksDataUrl(dataUrl: string): { keys: JWK[] } {
  const [prefix, base64Payload] = dataUrl.split(",", 2);
  if (
    prefix !== "data:text/plain;charset=utf-8;base64" ||
    base64Payload === undefined
  ) {
    throw new Error("Invalid Better Auth inline JWKS data URL.");
  }

  const decoded = JSON.parse(
    Buffer.from(base64Payload, "base64").toString("utf8")
  ) as unknown;
  if (!isJsonWebKeySet(decoded)) {
    throw new Error("Invalid Better Auth inline JWKS payload.");
  }

  return decoded;
}

function isJsonWebKeySet(value: unknown): value is { keys: JWK[] } {
  if (typeof value !== "object" || value === null || !("keys" in value)) {
    return false;
  }

  const keys = (value as { keys?: unknown }).keys;
  return (
    Array.isArray(keys) &&
    keys.every((key) => typeof key === "object" && key !== null)
  );
}
