import type { UserPrincipal } from "../coreTypes";
import type { AuthIdentityRecord } from "../identity/types";

export type UserPrincipalInput = {
  userId: string;
  activeOrganizationId: string | null;
  membershipIds: string[];
  roleKeys: string[];
  permissions: string[];
  sessionId: string | null;
  isRestricted?: boolean;
  restrictedReason?: string | null;
  identity?: Pick<AuthIdentityRecord, "identityId"> | null;
};

export function resolveUserPrincipal(input: UserPrincipalInput): UserPrincipal {
  return {
    kind: "user",
    userId: input.userId,
    identityId: input.identity?.identityId ?? null,
    activeOrganizationId: input.activeOrganizationId,
    membershipIds: input.membershipIds,
    roleKeys: input.roleKeys,
    permissions: input.permissions,
    sessionId: input.sessionId,
    isRestricted: input.isRestricted ?? false,
    restrictedReason: input.restrictedReason ?? null,
  };
}
