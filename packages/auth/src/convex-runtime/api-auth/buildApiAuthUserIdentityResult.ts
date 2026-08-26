export type ApiAuthMembershipRecord<
  TMembershipId extends string = string,
  TOrganizationId extends string = string,
  TRole extends string = string,
> = {
  _id: TMembershipId;
  organizationId: TOrganizationId;
  roleTemplate: TRole;
  status: string;
  permissions?: readonly string[] | null;
};

export type ApiAuthUserIdentityResult = {
  userId: string;
  identityId: string | null;
  activeOrganizationId: string | null;
  membershipIds: string[];
  roleKeys: string[];
  permissions: string[];
  isRestricted: boolean;
  restrictedReason: string | null;
};

export function buildApiAuthUserIdentityResult<
  TMembershipId extends string = string,
  TOrganizationId extends string = string,
  TRole extends string = string,
>(args: {
  userId: string;
  linkedIdentityId?: string | null;
  activeOrganizationId?: TOrganizationId | null;
  memberships: readonly ApiAuthMembershipRecord<TMembershipId, TOrganizationId, TRole>[];
  isRestricted?: boolean;
  restrictedReason?: string | null;
}): ApiAuthUserIdentityResult {
  const activeMemberships = args.memberships.filter((membership) => membership.status === "active");

  return {
    userId: args.userId,
    identityId: args.linkedIdentityId ?? null,
    activeOrganizationId: args.activeOrganizationId ?? null,
    membershipIds: activeMemberships.map((membership) => membership._id),
    roleKeys: activeMemberships.map((membership) => membership.roleTemplate),
    permissions: [],
    isRestricted: args.isRestricted ?? false,
    restrictedReason: args.restrictedReason ?? null,
  };
}
