import {
  readHttpsUrl,
  readObject,
  readOptionalString,
  readRequiredInteger,
  readRequiredString,
  readStringArray,
} from "./shared";

export type AgentAuthProtocolPublicEd25519Jwk = {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid?: string;
  alg?: "EdDSA";
  use?: "sig";
};

export type AgentAuthProtocolHostJwtHeader = {
  alg: "EdDSA";
  typ: "host+jwt";
  kid?: string;
};

export type AgentAuthProtocolAgentJwtHeader = {
  alg: "EdDSA";
  typ: "agent+jwt";
  kid?: string;
};

export type AgentAuthProtocolHostJwtClaims = {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  host_public_key?: AgentAuthProtocolPublicEd25519Jwk;
  host_jwks_url?: string;
  agent_public_key?: AgentAuthProtocolPublicEd25519Jwk;
  agent_jwks_url?: string;
  agent_kid?: string;
};

export type AgentAuthProtocolAgentJwtClaims = {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  capabilities?: string[];
};

export type ParsedAgentAuthProtocolHostJwt = {
  header: AgentAuthProtocolHostJwtHeader;
  claims: AgentAuthProtocolHostJwtClaims;
};

export type ParsedAgentAuthProtocolAgentJwt = {
  header: AgentAuthProtocolAgentJwtHeader;
  claims: AgentAuthProtocolAgentJwtClaims;
};

export function parseAgentAuthProtocolHostJwt(args: {
  header: unknown;
  claims: unknown;
  registration: boolean;
}): ParsedAgentAuthProtocolHostJwt {
  const header = parseHostHeader(args.header);
  const object = readObject(args.claims, "host JWT claims");
  const base = readBaseClaims(object);
  const hostPublicKey = readOptionalPublicKey(object, "host_public_key");
  const hostJwksUrl = readOptionalHttpsUrl(object, "host_jwks_url");
  requireExactlyOneKeySource(hostPublicKey, hostJwksUrl, "host_public_key", "host_jwks_url");
  if (hostJwksUrl !== undefined && header.kid === undefined) {
    throw new TypeError("host JWT header kid is required with host_jwks_url");
  }

  const agentPublicKey = readOptionalPublicKey(object, "agent_public_key");
  const agentJwksUrl = readOptionalHttpsUrl(object, "agent_jwks_url");
  const agentKid = readOptionalString(object, "agent_kid");
  if (agentPublicKey !== undefined && (agentJwksUrl !== undefined || agentKid !== undefined)) {
    throw new TypeError("agent_public_key cannot be combined with agent_jwks_url or agent_kid");
  }
  if (agentJwksUrl !== undefined && (agentKid === undefined || agentPublicKey !== undefined)) {
    throw new TypeError("agent_jwks_url requires agent_kid and no inline key");
  }
  if (agentKid !== undefined && agentJwksUrl === undefined) {
    throw new TypeError("agent_kid requires agent_jwks_url");
  }
  if (hostJwksUrl !== undefined && hostJwksUrl === agentJwksUrl) {
    throw new TypeError("host_jwks_url and agent_jwks_url must use different endpoints");
  }
  if (args.registration && agentPublicKey === undefined && agentJwksUrl === undefined) {
    throw new TypeError("registration host JWT requires agent_public_key or agent_jwks_url");
  }

  return {
    header,
    claims: {
      ...base,
      ...(hostPublicKey === undefined ? {} : { host_public_key: hostPublicKey }),
      ...(hostJwksUrl === undefined ? {} : { host_jwks_url: hostJwksUrl }),
      ...(agentPublicKey === undefined ? {} : { agent_public_key: agentPublicKey }),
      ...(agentJwksUrl === undefined ? {} : { agent_jwks_url: agentJwksUrl }),
      ...(agentKid === undefined ? {} : { agent_kid: agentKid }),
    },
  };
}

export function parseAgentAuthProtocolAgentJwt(args: {
  header: unknown;
  claims: unknown;
}): ParsedAgentAuthProtocolAgentJwt {
  const header = parseAgentHeader(args.header);
  const object = readObject(args.claims, "agent JWT claims");
  const base = readBaseClaims(object);
  const sub = readRequiredString(object, "sub");
  const capabilities =
    object.capabilities === undefined
      ? undefined
      : readStringArray(object.capabilities, "capabilities", {
          allowEmpty: true,
        });
  return {
    header,
    claims: {
      ...base,
      sub,
      ...(capabilities === undefined ? {} : { capabilities }),
    },
  };
}

function parseHostHeader(value: unknown): AgentAuthProtocolHostJwtHeader {
  const object = readObject(value, "host JWT header");
  assertHeader(object, "host+jwt");
  const kid = readOptionalString(object, "kid");
  return {
    alg: "EdDSA",
    typ: "host+jwt",
    ...(kid === undefined ? {} : { kid }),
  };
}

function parseAgentHeader(value: unknown): AgentAuthProtocolAgentJwtHeader {
  const object = readObject(value, "agent JWT header");
  assertHeader(object, "agent+jwt");
  const kid = readOptionalString(object, "kid");
  return {
    alg: "EdDSA",
    typ: "agent+jwt",
    ...(kid === undefined ? {} : { kid }),
  };
}

function assertHeader(object: Record<string, unknown>, typ: "host+jwt" | "agent+jwt"): void {
  if (object.alg !== "EdDSA") {
    throw new TypeError("JWT header alg must be EdDSA");
  }
  if (object.typ !== typ) {
    throw new TypeError(`JWT header typ must be ${typ}`);
  }
}

function readBaseClaims(object: Record<string, unknown>): {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
} {
  const iss = readRequiredString(object, "iss");
  const aud = readRequiredString(object, "aud");
  const iat = readRequiredInteger(object, "iat");
  const exp = readRequiredInteger(object, "exp");
  const jti = readRequiredString(object, "jti");
  if (iat < 0 || exp < 0) {
    throw new TypeError("iat and exp must be nonnegative");
  }
  if (exp <= iat) {
    throw new TypeError("exp must be greater than iat");
  }
  return { iss, aud, iat, exp, jti };
}

function readOptionalPublicKey(
  object: Record<string, unknown>,
  key: string,
): AgentAuthProtocolPublicEd25519Jwk | undefined {
  const value = object[key];
  return value === undefined ? undefined : parseAgentAuthProtocolPublicEd25519Jwk(value, key);
}

export function parseAgentAuthProtocolPublicEd25519Jwk(
  value: unknown,
  name = "public JWK",
): AgentAuthProtocolPublicEd25519Jwk {
  const object = readObject(value, name);
  if (object.kty !== "OKP" || object.crv !== "Ed25519") {
    throw new TypeError(`${name} must be an OKP Ed25519 public JWK`);
  }
  if (typeof object.x !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(object.x)) {
    throw new TypeError(`${name}.x must encode exactly one 32-byte Ed25519 public key`);
  }
  if ("d" in object) {
    throw new TypeError(`${name} must not contain private key material`);
  }
  if (object.alg !== undefined && object.alg !== "EdDSA") {
    throw new TypeError(`${name}.alg must be EdDSA when present`);
  }
  if (object.use !== undefined && object.use !== "sig") {
    throw new TypeError(`${name}.use must be sig when present`);
  }
  const kid = readOptionalString(object, "kid");
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: object.x,
    ...(kid === undefined ? {} : { kid }),
    ...(object.alg === undefined ? {} : { alg: "EdDSA" }),
    ...(object.use === undefined ? {} : { use: "sig" }),
  };
}

function readOptionalHttpsUrl(object: Record<string, unknown>, key: string): string | undefined {
  const value = readOptionalString(object, key);
  return value === undefined ? undefined : readHttpsUrl(value, key);
}

function requireExactlyOneKeySource(
  inlineKey: AgentAuthProtocolPublicEd25519Jwk | undefined,
  jwksUrl: string | undefined,
  inlineName: string,
  jwksName: string,
): void {
  if ((inlineKey === undefined) === (jwksUrl === undefined)) {
    throw new TypeError(`Exactly one of ${inlineName} or ${jwksName} is required`);
  }
}
