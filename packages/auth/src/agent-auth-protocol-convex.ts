import { resolveAgentPrincipal } from "./compat/convex/resolveAgentPrincipal";
import { decodeJwt, decodeProtectedHeader } from "jose";

import {
  parseAgentAuthProtocolAgentJwt,
  parseAgentAuthProtocolHostJwt,
  verifyAgentAuthProtocolAgentJwt,
  verifyAgentAuthProtocolHostJwt,
} from "./agent-auth-protocol";

export type AgentAuthProtocolVerificationMaterial = {
  agentId: string;
  hostId: string;
  organizationId: string;
  agentKeyGeneration: number;
  agentPublicJwkJson: string;
  hostKeyGeneration: number;
  hostThumbprint: string;
};

export type AgentAuthProtocolAuthorityResult = {
  kind: "agent";
  agentId: string;
  hostId: string;
  organizationId: string;
  mode: "delegated" | "autonomous";
  delegatedUserId: string | null;
  credentialId: string;
  permissions: string[];
  capabilityGrants: Array<{
    capability: string;
    constraintsJson?: string;
    expiresAt?: number;
  }>;
  isRestricted: boolean;
  restrictedReason: string | null;
};

export type AgentAuthProtocolHostVerificationMaterial = {
  hostId: string;
  organizationId: string;
  generation: number;
  thumbprint: string;
  publicJwkJson: string;
};

export type AgentAuthProtocolHostAuthorityResult = {
  hostId: string;
  organizationId: string;
  keyGeneration: number;
};

export type AgentAuthProtocolHostRequestAuthorityAdapter = {
  getVerificationMaterial(input: {
    thumbprint: string;
  }): Promise<AgentAuthProtocolHostVerificationMaterial | null>;
  consumeRequest(input: {
    hostId: string;
    keyGeneration: number;
    replayIdHash: string;
    replayExpiresAt: number;
    requestedOrganizationId?: string;
  }): Promise<AgentAuthProtocolHostAuthorityResult>;
};

export type AgentAuthProtocolCredentialConsumptionInput = {
  agentId: string;
  keyGeneration: number;
  hostKeyGeneration: number;
  replayIdHash: string;
  replayExpiresAt: number;
  requestedOrganizationId?: string;
  claimedCapabilities?: string[];
};

type AgentPrincipalInput = Parameters<typeof resolveAgentPrincipal>[0];
type AgentCapabilityConstraints = NonNullable<
  AgentPrincipalInput["capabilityGrants"][number]["constraints"]
>;
type AgentCapabilityConstraint = AgentCapabilityConstraints[string];

export type AgentAuthProtocolAgentAuthorityAdapter = {
  getVerificationMaterial(input: {
    agentId: string;
    hostThumbprint: string;
  }): Promise<AgentAuthProtocolVerificationMaterial | null>;
  consumeCredential(
    input: AgentAuthProtocolCredentialConsumptionInput
  ): Promise<AgentAuthProtocolAuthorityResult>;
};

type ProtocolVerificationMaterialInput = Parameters<
  AgentAuthProtocolAgentAuthorityAdapter["getVerificationMaterial"]
>[0];
type ProtocolConsumeCredentialInput = Parameters<
  AgentAuthProtocolAgentAuthorityAdapter["consumeCredential"]
>[0];

export type ConvexAgentAuthProtocolAuthorityAdapterConfig<
  TVerificationMaterialQueryReference,
  TConsumeCredentialMutationReference,
> = {
  runQuery: (
    reference: TVerificationMaterialQueryReference,
    args: ProtocolVerificationMaterialInput
  ) => Promise<AgentAuthProtocolVerificationMaterial | null>;
  runMutation: (
    reference: TConsumeCredentialMutationReference,
    args: ProtocolConsumeCredentialInput
  ) => Promise<AgentAuthProtocolAuthorityResult>;
  refs: {
    getAgentProtocolVerificationMaterial: TVerificationMaterialQueryReference;
    consumeAgentCredential: TConsumeCredentialMutationReference;
  };
};

export type ResolveAgentAuthProtocolAgentPrincipalInput = {
  token: string;
  audience: string;
  requestedOrganizationId?: string;
  now?: number;
};

export type ResolveAgentAuthProtocolHostRequestInput = {
  token: string;
  audience: string;
  registration: boolean;
  requestedOrganizationId?: string;
  now?: number;
};

export async function resolveAgentAuthProtocolHostRequest(
  adapter: AgentAuthProtocolHostRequestAuthorityAdapter,
  input: ResolveAgentAuthProtocolHostRequestInput
) {
  const unverified = parseAgentAuthProtocolHostJwt({
    header: decodeProtectedHeader(input.token),
    claims: decodeJwt(input.token),
    registration: input.registration,
  });
  const material = await adapter.getVerificationMaterial({
    thumbprint: unverified.claims.iss,
  });
  if (material === null) {
    throw new Error("Agent Auth Protocol host authority is unknown");
  }
  const publicJwk: unknown = JSON.parse(material.publicJwkJson);
  const verified = await verifyAgentAuthProtocolHostJwt({
    token: input.token,
    expectedAudience: input.audience,
    registration: input.registration,
    resolvedPublicKey: publicJwk,
    ...(input.now === undefined ? {} : { options: { now: input.now } }),
  });
  if (verified.signingKeyThumbprint !== material.thumbprint) {
    throw new Error(
      "Agent Auth Protocol host verification material does not match credential"
    );
  }
  const authority = await adapter.consumeRequest({
    hostId: material.hostId,
    keyGeneration: material.generation,
    replayIdHash: await hashAgentAuthProtocolReplayId(
      material.hostId,
      verified.claims.jti
    ),
    replayExpiresAt: verified.replayExpiresAt,
    requestedOrganizationId: input.requestedOrganizationId,
  });
  if (
    authority.hostId !== material.hostId ||
    authority.organizationId !== material.organizationId ||
    authority.keyGeneration !== material.generation
  ) {
    throw new Error(
      "Agent Auth Protocol host authority does not match verified material"
    );
  }
  return { authority, verified };
}

export async function resolveAgentAuthProtocolAgentPrincipal(
  adapter: AgentAuthProtocolAgentAuthorityAdapter,
  input: ResolveAgentAuthProtocolAgentPrincipalInput
): Promise<ReturnType<typeof resolveAgentPrincipal>> {
  const unverified = parseAgentAuthProtocolAgentJwt({
    header: decodeProtectedHeader(input.token),
    claims: decodeJwt(input.token),
  });
  const material = await adapter.getVerificationMaterial({
    agentId: unverified.claims.sub,
    hostThumbprint: unverified.claims.iss,
  });
  if (material === null) {
    throw new Error("Agent Auth Protocol credential authority is unknown");
  }
  requireVerificationMaterialMatchesUnverifiedClaims(material, unverified);
  const publicJwk: unknown = JSON.parse(material.agentPublicJwkJson);
  const verified = await verifyAgentAuthProtocolAgentJwt({
    token: input.token,
    expectedAudience: input.audience,
    expectedHostThumbprint: material.hostThumbprint,
    expectedAgentId: material.agentId,
    publicKey: publicJwk,
    ...(input.now === undefined ? {} : { options: { now: input.now } }),
  });
  const replayIdHash = await hashAgentAuthProtocolReplayId(
    material.agentId,
    verified.claims.jti
  );
  const authority = await adapter.consumeCredential({
    agentId: material.agentId,
    keyGeneration: material.agentKeyGeneration,
    hostKeyGeneration: material.hostKeyGeneration,
    replayIdHash,
    replayExpiresAt: verified.replayExpiresAt,
    requestedOrganizationId: input.requestedOrganizationId,
    claimedCapabilities: verified.claims.capabilities,
  });
  requireAuthorityMatchesVerificationMaterial(authority, material);
  return resolveAgentPrincipal({
    ...authority,
    capabilityGrants: authority.capabilityGrants.map((grant) => ({
      capability: grant.capability,
      constraints: parseConstraints(grant.constraintsJson),
      expiresAt: grant.expiresAt ?? null,
    })),
  });
}

export function createConvexAgentAuthProtocolAuthorityAdapter<
  TVerificationMaterialQueryReference,
  TConsumeCredentialMutationReference,
>(
  config: ConvexAgentAuthProtocolAuthorityAdapterConfig<
    TVerificationMaterialQueryReference,
    TConsumeCredentialMutationReference
  >
): AgentAuthProtocolAgentAuthorityAdapter {
  return {
    async getVerificationMaterial(input) {
      return await config.runQuery(
        config.refs.getAgentProtocolVerificationMaterial,
        input
      );
    },
    async consumeCredential(input) {
      return await config.runMutation(
        config.refs.consumeAgentCredential,
        input
      );
    },
  };
}

export function createConvexAgentAuthProtocolHostRequestAuthorityAdapter<
  TVerificationMaterialQueryReference,
  TConsumeRequestMutationReference,
>(config: {
  runQuery: (
    reference: TVerificationMaterialQueryReference,
    args: { thumbprint: string }
  ) => Promise<AgentAuthProtocolHostVerificationMaterial | null>;
  runMutation: (
    reference: TConsumeRequestMutationReference,
    args: {
      hostId: string;
      keyGeneration: number;
      replayIdHash: string;
      replayExpiresAt: number;
      requestedOrganizationId?: string;
    }
  ) => Promise<AgentAuthProtocolHostAuthorityResult>;
  refs: {
    getAgentHostProtocolVerificationMaterial: TVerificationMaterialQueryReference;
    consumeAgentHostRequest: TConsumeRequestMutationReference;
  };
}): AgentAuthProtocolHostRequestAuthorityAdapter {
  return {
    async getVerificationMaterial(input) {
      return await config.runQuery(
        config.refs.getAgentHostProtocolVerificationMaterial,
        input
      );
    },
    async consumeRequest(input) {
      return await config.runMutation(
        config.refs.consumeAgentHostRequest,
        input
      );
    },
  };
}

function requireVerificationMaterialMatchesUnverifiedClaims(
  material: AgentAuthProtocolVerificationMaterial,
  unverified: ReturnType<typeof parseAgentAuthProtocolAgentJwt>
): void {
  if (
    material.agentId !== unverified.claims.sub ||
    material.hostThumbprint !== unverified.claims.iss
  ) {
    throw new Error(
      "Agent Auth Protocol verification material does not match credential"
    );
  }
}

function requireAuthorityMatchesVerificationMaterial(
  authority: AgentAuthProtocolAuthorityResult,
  material: AgentAuthProtocolVerificationMaterial
): void {
  if (
    authority.agentId !== material.agentId ||
    authority.hostId !== material.hostId ||
    authority.organizationId !== material.organizationId
  ) {
    throw new Error(
      "Agent Auth Protocol authority does not match verified material"
    );
  }
}

async function hashAgentAuthProtocolReplayId(
  agentId: string,
  replayId: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${agentId}\u0000${replayId}`)
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function parseConstraints(
  value: string | undefined
): Readonly<Record<string, AgentCapabilityConstraint>> | null {
  if (value === undefined) return null;
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Agent capability constraints are invalid");
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([key, constraint]) => [
      key,
      parseConstraint(constraint),
    ])
  );
}

function parseConstraint(value: unknown): AgentCapabilityConstraint {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Agent capability constraint is invalid");
  }
  const record = Object.fromEntries(Object.entries(value));
  const parsed: Exclude<AgentCapabilityConstraint, string | number | boolean> =
    {};
  if (record.eq !== undefined) parsed.eq = requirePrimitive(record.eq);
  if (record.min !== undefined) parsed.min = requireFiniteNumber(record.min);
  if (record.max !== undefined) parsed.max = requireFiniteNumber(record.max);
  if (record.in !== undefined) parsed.in = requirePrimitiveArray(record.in);
  const notIn = record.notIn ?? record.not_in;
  if (notIn !== undefined) parsed.notIn = requirePrimitiveArray(notIn);
  return parsed;
}

function requirePrimitive(value: unknown) {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new TypeError("Agent capability primitive is invalid");
  }
  return value;
}

function requirePrimitiveArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new TypeError("Agent capability primitive array is invalid");
  }
  return value.map(requirePrimitive);
}

function requireFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Agent capability numeric constraint is invalid");
  }
  return value;
}
