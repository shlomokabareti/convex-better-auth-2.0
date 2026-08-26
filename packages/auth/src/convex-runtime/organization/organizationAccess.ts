export type OrganizationAccessStatus = "active" | "suspended" | "deleted";

export type OrganizationMembershipStatus =
  | "active"
  | "pending"
  | "inactive"
  | "suspended";

export type OrganizationAccessOrganizationLike<TId extends string = string> = {
  _id: TId;
  status: OrganizationAccessStatus;
};

export type OrganizationAccessMembershipLike<
  TId extends string = string,
  TRole extends string = string,
> = {
  organizationId: TId;
  roleTemplate: TRole;
  status: OrganizationMembershipStatus;
};

export type OrganizationAccessUserLike<TId extends string = string> = {
  activeOrganizationId?: TId | null;
  isSuperAdmin?: boolean;
};

export type AvailableOrganization<
  TOrganization extends OrganizationAccessOrganizationLike,
  TRole extends string = string,
> = TOrganization & {
  canSelect: boolean;
  roleTemplate: TRole;
};

export type OrganizationPermissionContext<
  TId extends string = string,
  TRole extends string = string,
> = {
  userId: string;
  organizationId: TId;
  role: TRole;
  permissions: string[];
  isOwner: boolean;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: readonly string[]) => boolean;
  hasAllPermissions: (permissions: readonly string[]) => boolean;
};

export function resolveAvailableOrganizations<
  TId extends string,
  TRole extends string,
  TOrganization extends OrganizationAccessOrganizationLike<TId>,
>(
  user: OrganizationAccessUserLike<TId>,
  memberships: readonly OrganizationAccessMembershipLike<TId, TRole>[],
  organizations: readonly TOrganization[],
  options: {
    superAdminRole: TRole;
  }
): Array<AvailableOrganization<TOrganization, TRole>> {
  const activeOrganizations = organizations.filter(
    (organization) => organization.status === "active"
  );
  const superAdminRole = options.superAdminRole;

  if (user.isSuperAdmin) {
    return activeOrganizations.map((organization) => ({
      ...organization,
      canSelect: true,
      roleTemplate: superAdminRole,
    }));
  }

  const organizationById = new Map(
    activeOrganizations.map((organization) => [organization._id, organization])
  );

  return memberships.flatMap((membership) => {
    if (membership.status !== "active" && membership.status !== "pending") {
      return [];
    }

    const organization = organizationById.get(membership.organizationId);
    if (!organization) {
      return [];
    }

    return [
      {
        ...organization,
        canSelect: membership.status === "active",
        roleTemplate: membership.roleTemplate,
      },
    ];
  });
}

export function resolveActiveOrganization<
  TId extends string,
  TRole extends string,
  TOrganization extends OrganizationAccessOrganizationLike<TId>,
>(
  user: OrganizationAccessUserLike<TId>,
  availableOrganizations: readonly AvailableOrganization<
    TOrganization,
    TRole
  >[],
  activeOrganization: TOrganization | null,
  options: {
    superAdminRole: TRole;
  }
): AvailableOrganization<TOrganization, TRole> | null {
  const superAdminRole = options.superAdminRole;

  if (user.activeOrganizationId && activeOrganization?.status === "active") {
    const membershipMatch = availableOrganizations.find(
      (organization) => organization._id === user.activeOrganizationId
    );

    if (membershipMatch) {
      return membershipMatch;
    }

    if (user.isSuperAdmin) {
      return {
        ...activeOrganization,
        canSelect: true,
        roleTemplate: superAdminRole,
      };
    }
  }

  return (
    availableOrganizations.find((organization) => organization.canSelect) ??
    null
  );
}

export function buildOrganizationPermissionContext<
  TId extends string,
  TRole extends string,
>(args: {
  user: OrganizationAccessUserLike<TId>;
  organization: { _id: TId; roleTemplate: TRole };
  userId: string;
  expandPermissions: (role: TRole) => readonly string[];
  hasPermission: (
    permissions: readonly string[],
    permission: string
  ) => boolean;
  hasAnyPermission?: (
    permissions: readonly string[],
    requiredPermissions: readonly string[]
  ) => boolean;
  hasAllPermissions?: (
    permissions: readonly string[],
    requiredPermissions: readonly string[]
  ) => boolean;
  ownerRoles?: readonly TRole[];
  adminRoles?: readonly TRole[];
  superAdminRole?: TRole;
  superAdminPermissions?: readonly string[];
}): OrganizationPermissionContext<TId, TRole> {
  const superAdminRole = args.superAdminRole ?? args.organization.roleTemplate;
  const ownerRoles = args.ownerRoles ?? [superAdminRole];
  const adminRoles = args.adminRoles ?? ownerRoles;

  if (args.user.isSuperAdmin) {
    const permissions = [...(args.superAdminPermissions ?? ["*"])];

    return {
      userId: args.userId,
      organizationId: args.organization._id,
      role: superAdminRole,
      permissions,
      isOwner: true,
      isAdmin: true,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    };
  }

  const role = args.organization.roleTemplate;
  const permissions = [...args.expandPermissions(role)];

  return {
    userId: args.userId,
    organizationId: args.organization._id,
    role,
    permissions,
    isOwner: ownerRoles.includes(role),
    isAdmin: adminRoles.includes(role),
    hasPermission: (permission: string) =>
      args.hasPermission(permissions, permission),
    hasAnyPermission: (requiredPermissions: readonly string[]) =>
      args.hasAnyPermission
        ? args.hasAnyPermission(permissions, requiredPermissions)
        : requiredPermissions.some((permission) =>
            args.hasPermission(permissions, permission)
          ),
    hasAllPermissions: (requiredPermissions: readonly string[]) =>
      args.hasAllPermissions
        ? args.hasAllPermissions(permissions, requiredPermissions)
        : requiredPermissions.every((permission) =>
            args.hasPermission(permissions, permission)
          ),
  };
}
