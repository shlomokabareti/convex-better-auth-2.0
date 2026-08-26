import type { ApiResolvedAuthContext } from "../coreTypes";
import {
  resolveAuthorizedUserOrganizationAccess,
  type AuthorizeResolvedUserOrganizationAccessArgs,
} from "./resolveAuthorizedUserOrganizationAccess";

export type AuthorizedApiAuthType = "jwt" | "api_key" | "oauth";

export type ResolveAuthorizedApiAuthContextArgs<TRole extends string = string> =
  {
    authType: AuthorizedApiAuthType;
    authSubject: string;
  } & AuthorizeResolvedUserOrganizationAccessArgs<TRole>;

export type AuthorizedApiAuthContext<TRole extends string = string> = {
  auth: ApiResolvedAuthContext;
  authType: AuthorizedApiAuthType;
  authSubject: string;
  scopes: string[];
  userId: string;
  organizationId: string;
  role: TRole;
  permissions: string[];
};

export async function resolveAuthorizedApiAuthContext<
  TRole extends string = string,
>(
  args: ResolveAuthorizedApiAuthContextArgs<TRole>
): Promise<AuthorizedApiAuthContext<TRole> | null> {
  const access = await resolveAuthorizedUserOrganizationAccess(args);
  if (access === null) {
    return null;
  }

  return {
    auth: args.auth,
    authType: args.authType,
    authSubject: args.authSubject,
    scopes: [...access.scopes],
    userId: access.userId,
    organizationId: access.organizationId,
    role: access.role,
    permissions: [...access.permissions],
  };
}
