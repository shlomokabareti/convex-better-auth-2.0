import type { ApiKeyPrincipal } from "../coreTypes";
import { computeEffectiveApiKeyPermissions } from "../machine/computeEffectiveApiKeyPermissions";
import type { ApiKeyRecord } from "../machine/types";

export type ApiKeyPrincipalInput = Pick<
  ApiKeyRecord,
  "apiKeyId" | "ownerType" | "ownerId" | "fixedOrganizationId" | "permissions"
> & {
  ownerPermissions: readonly string[];
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export function resolveApiKeyPrincipal(
  input: ApiKeyPrincipalInput
): ApiKeyPrincipal {
  const inheritedPermissions = [...input.ownerPermissions];
  const effectivePermissions = computeEffectiveApiKeyPermissions({
    ownerPermissions: input.ownerPermissions,
    apiKey: { permissions: input.permissions },
  });

  return {
    kind: "apiKey",
    apiKeyId: input.apiKeyId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    organizationId: input.fixedOrganizationId,
    inheritedPermissions,
    narrowedPermissions: input.permissions,
    effectivePermissions,
    isRestricted: input.isRestricted ?? false,
    restrictedReason: input.restrictedReason ?? null,
  };
}
