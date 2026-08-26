import { hasPermission } from "../../compat/permissions";

import { resolveConvexUserContext, type ConvexUserIdentity } from "./resolveConvexUserContext";

export type ResolvedViewerAccess<
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
> = {
  activeOrganizationId: TOrganizationId;
  membershipIds: TMembershipId[];
  roleKeys: string[];
  permissions: string[];
};

export type AssembleViewerContextInput<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
> = {
  identity: TIdentity;
  localIdentity: TLocalIdentity;
  user: TUser;
  userId: string;
  identityId: string | null;
  access: ResolvedViewerAccess<TOrganizationId, TMembershipId>;
  isRestricted: boolean;
  restrictedReason: string | null;
};

export type AssembledViewerContext<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
> = {
  identity: TIdentity;
  localIdentity: TLocalIdentity;
  user: TUser;
  authContext: ReturnType<typeof resolveConvexUserContext>;
  activeOrganizationId: TOrganizationId;
  membershipIds: TMembershipId[];
  roleKeys: string[];
  permissions: string[];
  hasPermission: (permission: string) => boolean;
};

export function assembleViewerContext<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
>(
  input: AssembleViewerContextInput<
    TIdentity,
    TLocalIdentity,
    TUser,
    TOrganizationId,
    TMembershipId
  >,
): AssembledViewerContext<TIdentity, TLocalIdentity, TUser, TOrganizationId, TMembershipId> {
  const sessionId = sessionIdFromConvexIdentity(input.identity);

  return {
    identity: input.identity,
    localIdentity: input.localIdentity,
    user: input.user,
    authContext: resolveConvexUserContext({
      identity: input.identity,
      principal: {
        userId: input.userId,
        identityId: input.identityId,
        activeOrganizationId: input.access.activeOrganizationId,
        membershipIds: input.access.membershipIds,
        roleKeys: input.access.roleKeys,
        permissions: input.access.permissions,
        sessionId,
        isRestricted: input.isRestricted,
        restrictedReason: input.restrictedReason,
      },
      input: {},
    }),
    activeOrganizationId: input.access.activeOrganizationId,
    membershipIds: input.access.membershipIds,
    roleKeys: input.access.roleKeys,
    permissions: input.access.permissions,
    hasPermission: (permission: string) => hasPermission(input.access.permissions, permission),
  };
}

export function sessionIdFromConvexIdentity(identity: ConvexUserIdentity): string | null {
  return typeof identity.sessionId === "string"
    ? identity.sessionId
    : typeof identity.sid === "string"
      ? identity.sid
      : null;
}
