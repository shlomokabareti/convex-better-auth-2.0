import type { ServicePrincipal } from "../coreTypes";
import type { ServicePrincipalRecord } from "../machine/types";

export type ServicePrincipalInput = Pick<
  ServicePrincipalRecord,
  "serviceId" | "organizationId" | "permissions"
> & {
  keyId?: string | null;
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export function resolveServicePrincipal(input: ServicePrincipalInput): ServicePrincipal {
  return {
    kind: "service",
    serviceId: input.serviceId,
    keyId: input.keyId ?? null,
    organizationId: input.organizationId,
    permissions: input.permissions,
    isRestricted: input.isRestricted ?? false,
    restrictedReason: input.restrictedReason ?? null,
  };
}
