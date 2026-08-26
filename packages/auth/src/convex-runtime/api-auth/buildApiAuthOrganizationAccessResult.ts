import type { ApiAuthMembershipRecord } from "./buildApiAuthUserIdentityResult";

export type ApiAuthOrganizationAccessResult = {
  organizationId: string | null;
  membershipIds: string[];
  roleKeys: string[];
  permissions: string[];
};

export function buildApiAuthOrganizationAccessResult<
  TMembershipId extends string = string,
  TOrganizationId extends string = string,
  TRole extends string = string,
>(args: {
  memberships: readonly ApiAuthMembershipRecord<
    TMembershipId,
    TOrganizationId,
    TRole
  >[];
  organizationId: TOrganizationId | null;
  expandPermissions: (role: TRole) => readonly string[];
}): ApiAuthOrganizationAccessResult {
  if (args.organizationId === null) {
    return {
      organizationId: null,
      membershipIds: [],
      roleKeys: [],
      permissions: [],
    };
  }

  const organizationMemberships = args.memberships.filter(
    (membership) =>
      membership.status === "active" &&
      membership.organizationId === args.organizationId
  );

  const roleKeys = Array.from(
    new Set(
      organizationMemberships.map((membership) => membership.roleTemplate)
    )
  );

  const permissions = Array.from(
    new Set(
      organizationMemberships.flatMap(
        (membership) =>
          membership.permissions ??
          args.expandPermissions(membership.roleTemplate)
      )
    )
  );

  return {
    organizationId: args.organizationId,
    membershipIds: organizationMemberships.map((membership) => membership._id),
    roleKeys,
    permissions,
  };
}
