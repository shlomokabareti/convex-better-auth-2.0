import type { ResolvedAuthContext, UserPrincipal } from "../coreTypes";
import { resolvePrincipal } from "./resolvePrincipal";
import { resolveUserPrincipal } from "./resolveUserPrincipal";
import type { PrincipalResolutionInput } from "./types";

export type ConvexUserIdentity = {
  subject: string;
  issuer: string;
  tokenIdentifier: string;
  [claim: string]: unknown;
};

export type ConvexUserPrincipalRecord = {
  userId?: string;
  identityId?: string | null;
  activeOrganizationId?: string | null;
  membershipIds?: string[];
  roleKeys?: string[];
  permissions?: string[];
  sessionId?: string | null;
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export function resolveConvexUserPrincipal(args: {
  identity: ConvexUserIdentity;
  principal?: ConvexUserPrincipalRecord | null;
}): UserPrincipal {
  const principal = args.principal ?? null;
  const identity = args.identity;

  return resolveUserPrincipal({
    userId: principal?.userId ?? identity.subject,
    identity: {
      identityId: principal?.identityId ?? identity.tokenIdentifier,
    },
    ...resolvePrincipalAccessFields(principal),
    sessionId: principal?.sessionId ?? sessionIdFromIdentity(identity),
  });
}

function resolvePrincipalAccessFields(principal: ConvexUserPrincipalRecord | null) {
  return {
    activeOrganizationId: principal?.activeOrganizationId ?? null,
    membershipIds: principal?.membershipIds ?? [],
    roleKeys: principal?.roleKeys ?? [],
    permissions: principal?.permissions ?? [],
    isRestricted: principal?.isRestricted ?? false,
    restrictedReason: principal?.restrictedReason ?? null,
  };
}

export function resolveConvexUserContext(args: {
  identity: ConvexUserIdentity;
  principal?: ConvexUserPrincipalRecord | null;
  input?: Omit<PrincipalResolutionInput, "credentialType">;
}): ResolvedAuthContext & { principal: UserPrincipal } {
  const principal = resolveConvexUserPrincipal({
    identity: args.identity,
    principal: args.principal,
  });

  return {
    ...resolvePrincipal({
      credentialType: "userToken",
      principal,
      ...args.input,
    }),
    principal,
  };
}

function sessionIdFromIdentity(identity: ConvexUserIdentity): string | null {
  const sessionId = identity.sessionId;
  if (typeof sessionId === "string") {
    return sessionId;
  }

  const sid = identity.sid;
  if (typeof sid === "string") {
    return sid;
  }

  return null;
}
