import type {
  ApiKeyPrincipal,
  ResolvedAuthContext,
  ServicePrincipal,
} from "../coreTypes";
import {
  requireActiveApiKeyRecord,
  requireActiveServicePrincipal,
  type ApiKeyRecord,
  type ServicePrincipalRecord,
} from "../machine";
import { resolveApiKeyPrincipal } from "./resolveApiKeyPrincipal";
import { resolvePrincipal } from "./resolvePrincipal";
import { resolveServicePrincipal } from "./resolveServicePrincipal";
import type { PrincipalResolutionInput } from "./types";

export type ActiveApiKeyContextInput = {
  apiKey: Pick<
    ApiKeyRecord,
    | "apiKeyId"
    | "ownerType"
    | "ownerId"
    | "fixedOrganizationId"
    | "permissions"
    | "status"
    | "expiresAt"
    | "createdAt"
    | "lastUsedAt"
    | "maxIdleMs"
  >;
  ownerPermissions: readonly string[];
  input?: Omit<PrincipalResolutionInput, "credentialType">;
  now?: number;
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export type ActiveServiceContextInput = {
  servicePrincipal: Pick<
    ServicePrincipalRecord,
    "serviceId" | "organizationId" | "permissions" | "status"
  >;
  input?: Omit<PrincipalResolutionInput, "credentialType">;
  keyId?: string | null;
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export type ActiveServiceOwnedApiKeyContextInput = {
  apiKey: Pick<
    ApiKeyRecord,
    | "apiKeyId"
    | "ownerType"
    | "ownerId"
    | "fixedOrganizationId"
    | "permissions"
    | "status"
    | "expiresAt"
    | "createdAt"
    | "lastUsedAt"
    | "maxIdleMs"
  >;
  servicePrincipal: Pick<
    ServicePrincipalRecord,
    "serviceId" | "organizationId" | "permissions" | "status"
  >;
  input?: Omit<PrincipalResolutionInput, "credentialType">;
  now?: number;
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export type ActiveServiceOwnedApiKeyContext = ResolvedAuthContext & {
  principal: ApiKeyPrincipal;
  servicePrincipal: ServicePrincipal;
};

export function resolveActiveApiKeyContext(
  args: ActiveApiKeyContextInput
): ResolvedAuthContext {
  requireActiveApiKeyRecord(args.apiKey, args.now);

  const principal = resolveApiKeyPrincipal({
    apiKeyId: args.apiKey.apiKeyId,
    ownerType: args.apiKey.ownerType,
    ownerId: args.apiKey.ownerId,
    fixedOrganizationId: args.apiKey.fixedOrganizationId,
    permissions: args.apiKey.permissions,
    ownerPermissions: args.ownerPermissions,
    isRestricted: args.isRestricted,
    restrictedReason: args.restrictedReason,
  });

  return resolvePrincipal({
    credentialType: "apiKey",
    principal,
    ...args.input,
  });
}

export function resolveActiveServiceContext(
  args: ActiveServiceContextInput
): ResolvedAuthContext & { principal: ServicePrincipal } {
  requireActiveServicePrincipal(args.servicePrincipal);

  const principal = resolveServicePrincipal({
    serviceId: args.servicePrincipal.serviceId,
    organizationId: args.servicePrincipal.organizationId,
    permissions: args.servicePrincipal.permissions,
    keyId: args.keyId,
    isRestricted: args.isRestricted,
    restrictedReason: args.restrictedReason,
  });

  return {
    ...resolvePrincipal({
      credentialType: "serviceCredential",
      principal,
      ...args.input,
    }),
    principal,
  };
}

export function resolveActiveServiceOwnedApiKeyContext(
  args: ActiveServiceOwnedApiKeyContextInput
): ActiveServiceOwnedApiKeyContext {
  requireActiveApiKeyRecord(args.apiKey, args.now);
  requireActiveServicePrincipal(args.servicePrincipal);

  if (args.apiKey.ownerType !== "service") {
    throw new Error("Service-owned API key context requires ownerType service");
  }

  if (args.apiKey.ownerId !== args.servicePrincipal.serviceId) {
    throw new Error("API key owner does not match service principal");
  }

  const organizationId =
    args.apiKey.fixedOrganizationId ??
    args.servicePrincipal.organizationId ??
    args.input?.organizationId ??
    null;
  const servicePrincipal = resolveServicePrincipal({
    serviceId: args.servicePrincipal.serviceId,
    organizationId,
    permissions: args.servicePrincipal.permissions,
    keyId: args.apiKey.apiKeyId,
    isRestricted: args.isRestricted,
    restrictedReason: args.restrictedReason,
  });
  const principal = resolveApiKeyPrincipal({
    apiKeyId: args.apiKey.apiKeyId,
    ownerType: args.apiKey.ownerType,
    ownerId: args.apiKey.ownerId,
    fixedOrganizationId: organizationId,
    permissions: args.apiKey.permissions,
    ownerPermissions: servicePrincipal.permissions,
    isRestricted: args.isRestricted,
    restrictedReason: args.restrictedReason,
  });

  return {
    ...resolvePrincipal({
      credentialType: "apiKey",
      principal,
      ...args.input,
      organizationId,
    }),
    principal,
    servicePrincipal,
  };
}
