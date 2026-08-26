import {
  calculateJwkThumbprint,
  decodeJwt,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
} from "jose";

import {
  parseAgentAuthProtocolAgentJwt,
  parseAgentAuthProtocolHostJwt,
  parseAgentAuthProtocolPublicEd25519Jwk,
  type AgentAuthProtocolPublicEd25519Jwk,
  type ParsedAgentAuthProtocolAgentJwt,
  type ParsedAgentAuthProtocolHostJwt,
} from "./jwt";

export const AGENT_AUTH_PROTOCOL_MAX_JWT_LIFETIME_SECONDS = 60 as const;
export const AGENT_AUTH_PROTOCOL_MAX_CLOCK_SKEW_SECONDS = 30 as const;

export type AgentAuthProtocolJwtVerificationOptions = {
  now?: number;
  maxLifetimeSeconds?: number;
  clockSkewSeconds?: number;
};

export type VerifiedAgentAuthProtocolHostJwt =
  ParsedAgentAuthProtocolHostJwt & {
    signingKeyThumbprint: string;
    replayExpiresAt: number;
  };

export type VerifiedAgentAuthProtocolAgentJwt =
  ParsedAgentAuthProtocolAgentJwt & {
    replayExpiresAt: number;
  };

export async function verifyAgentAuthProtocolHostJwt(args: {
  token: string;
  expectedAudience: string;
  registration: boolean;
  resolvedPublicKey?: unknown;
  expectedKeyId?: string;
  options?: AgentAuthProtocolJwtVerificationOptions;
}): Promise<VerifiedAgentAuthProtocolHostJwt> {
  const parsed = parseAgentAuthProtocolHostJwt({
    header: decodeProtectedHeader(args.token),
    claims: decodeJwt(args.token),
    registration: args.registration,
  });
  const publicKey =
    parsed.claims.host_public_key ??
    parseAgentAuthProtocolPublicEd25519Jwk(
      args.resolvedPublicKey,
      "resolved host public JWK"
    );
  requireExpectedKeyId(parsed.header.kid, publicKey, args.expectedKeyId);
  const thumbprint = await calculateJwkThumbprint(publicKey, "sha256");
  if (parsed.claims.iss !== thumbprint) {
    throw new Error(
      "host JWT issuer does not match its signing key thumbprint"
    );
  }
  const temporal = verifyTemporalAndAudience(
    parsed.claims,
    args.expectedAudience,
    args.options
  );
  const key = await importJWK(publicKey, "EdDSA");
  await jwtVerify(args.token, key, {
    algorithms: ["EdDSA"],
    audience: args.expectedAudience,
    issuer: thumbprint,
    clockTolerance: temporal.clockSkewSeconds,
    currentDate: new Date(temporal.nowSeconds * 1000),
  });
  return {
    ...parsed,
    signingKeyThumbprint: thumbprint,
    replayExpiresAt: temporal.replayExpiresAt,
  };
}

export async function verifyAgentAuthProtocolAgentJwt(args: {
  token: string;
  expectedAudience: string;
  expectedHostThumbprint: string;
  expectedAgentId: string;
  publicKey: unknown;
  expectedKeyId?: string;
  options?: AgentAuthProtocolJwtVerificationOptions;
}): Promise<VerifiedAgentAuthProtocolAgentJwt> {
  const parsed = parseAgentAuthProtocolAgentJwt({
    header: decodeProtectedHeader(args.token),
    claims: decodeJwt(args.token),
  });
  if (parsed.claims.iss !== args.expectedHostThumbprint) {
    throw new Error("agent JWT issuer does not match its host");
  }
  if (parsed.claims.sub !== args.expectedAgentId) {
    throw new Error("agent JWT subject does not match its agent");
  }
  const publicKey = parseAgentAuthProtocolPublicEd25519Jwk(
    args.publicKey,
    "agent public JWK"
  );
  requireExpectedKeyId(parsed.header.kid, publicKey, args.expectedKeyId);
  const temporal = verifyTemporalAndAudience(
    parsed.claims,
    args.expectedAudience,
    args.options
  );
  const key = await importJWK(publicKey, "EdDSA");
  await jwtVerify(args.token, key, {
    algorithms: ["EdDSA"],
    audience: args.expectedAudience,
    issuer: args.expectedHostThumbprint,
    subject: args.expectedAgentId,
    clockTolerance: temporal.clockSkewSeconds,
    currentDate: new Date(temporal.nowSeconds * 1000),
  });
  return {
    ...parsed,
    replayExpiresAt: temporal.replayExpiresAt,
  };
}

function verifyTemporalAndAudience(
  claims: {
    aud: string;
    iat: number;
    exp: number;
  },
  expectedAudience: string,
  options: AgentAuthProtocolJwtVerificationOptions | undefined
): {
  clockSkewSeconds: number;
  nowSeconds: number;
  replayExpiresAt: number;
} {
  if (claims.aud !== expectedAudience) {
    throw new Error(
      "JWT audience does not exactly match the intended recipient"
    );
  }
  const maxLifetimeSeconds = readBoundedNonnegativeInteger(
    options?.maxLifetimeSeconds ?? AGENT_AUTH_PROTOCOL_MAX_JWT_LIFETIME_SECONDS,
    "maxLifetimeSeconds",
    AGENT_AUTH_PROTOCOL_MAX_JWT_LIFETIME_SECONDS
  );
  const clockSkewSeconds = readBoundedNonnegativeInteger(
    options?.clockSkewSeconds ?? AGENT_AUTH_PROTOCOL_MAX_CLOCK_SKEW_SECONDS,
    "clockSkewSeconds",
    AGENT_AUTH_PROTOCOL_MAX_CLOCK_SKEW_SECONDS
  );
  const now = options?.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError(
      "now must be a nonnegative safe integer in milliseconds"
    );
  }
  const nowSeconds = Math.floor(now / 1000);
  if (claims.iat > nowSeconds + clockSkewSeconds) {
    throw new Error("JWT issued-at time is too far in the future");
  }
  if (claims.exp - claims.iat > maxLifetimeSeconds) {
    throw new Error("JWT lifetime exceeds the Vortex server profile");
  }
  return {
    clockSkewSeconds,
    nowSeconds,
    replayExpiresAt: (claims.exp + clockSkewSeconds) * 1000,
  };
}

function requireExpectedKeyId(
  headerKeyId: string | undefined,
  publicKey: AgentAuthProtocolPublicEd25519Jwk,
  expectedKeyId: string | undefined
): void {
  if (expectedKeyId !== undefined && headerKeyId !== expectedKeyId) {
    throw new Error("JWT key id does not match the resolved signing key");
  }
  if (
    headerKeyId !== undefined &&
    publicKey.kid !== undefined &&
    headerKeyId !== publicKey.kid
  ) {
    throw new Error("JWT key id does not match the public JWK");
  }
}

function readBoundedNonnegativeInteger(
  value: number,
  name: string,
  maximum: number
): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be an integer between 0 and ${maximum}`);
  }
  return value;
}
