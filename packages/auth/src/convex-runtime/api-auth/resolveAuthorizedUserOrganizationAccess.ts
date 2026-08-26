import type { ApiResolvedAuthContext } from "../coreTypes";
import { ApiAuthError } from "./errors";

export type AuthorizeResolvedUserOrganizationAccessArgs<TRole extends string = string> = {
  auth: ApiResolvedAuthContext;
  userId?: string | null;
  organizationId?: string | null;
  authorizeOrganizationAccess: (args: {
    auth: ApiResolvedAuthContext;
    userId: string;
    organizationId: string;
  }) => Promise<{
    role: TRole;
    permissions: string[];
  } | null>;
};

export type AuthorizedUserOrganizationAccess<TRole extends string = string> = {
  userId: string;
  organizationId: string;
  role: TRole;
  permissions: string[];
  scopes: string[];
};

export async function resolveAuthorizedUserOrganizationAccess<TRole extends string = string>(
  args: AuthorizeResolvedUserOrganizationAccessArgs<TRole>,
): Promise<AuthorizedUserOrganizationAccess<TRole> | null> {
  const userId = args.userId ?? args.auth.userId;
  const organizationId = args.organizationId ?? args.auth.organizationId;

  if (userId === null || organizationId === null) {
    throw new ApiAuthError(
      "API_CREDENTIAL_INVALID",
      "Resolved auth context is missing required user or organization context.",
    );
  }

  const access = await args.authorizeOrganizationAccess({
    auth: args.auth,
    userId,
    organizationId,
  });
  if (access === null) {
    return null;
  }

  return {
    userId,
    organizationId,
    role: access.role,
    permissions: access.permissions,
    scopes: args.auth.scopes,
  };
}
