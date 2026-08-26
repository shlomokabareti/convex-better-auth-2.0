import type { ApiAuthLookupAdapter } from "./types";

type UserIdentityLookupArgs = Parameters<ApiAuthLookupAdapter["getUserByIdentity"]>[0];
type UserIdentityLookupResult = Awaited<ReturnType<ApiAuthLookupAdapter["getUserByIdentity"]>>;
type OrganizationAccessLookupArgs = Parameters<ApiAuthLookupAdapter["getOrganizationAccess"]>[0];
type OrganizationAccessLookupResult = Awaited<
  ReturnType<ApiAuthLookupAdapter["getOrganizationAccess"]>
>;

export type ConvexApiAuthLookupAdapterConfig<
  TUserIdentityQueryReference,
  TOrganizationAccessQueryReference,
> = {
  runUserIdentityQuery: (
    reference: TUserIdentityQueryReference,
    args: UserIdentityLookupArgs,
  ) => Promise<UserIdentityLookupResult>;
  runOrganizationAccessQuery: (
    reference: TOrganizationAccessQueryReference,
    args: OrganizationAccessLookupArgs,
  ) => Promise<OrganizationAccessLookupResult>;
  refs: {
    getUserByIdentity: TUserIdentityQueryReference;
    getOrganizationAccess: TOrganizationAccessQueryReference;
  };
  getApiKeyPrincipal?: ApiAuthLookupAdapter["getApiKeyPrincipal"];
};

export function createConvexApiAuthLookupAdapter<
  TUserIdentityQueryReference,
  TOrganizationAccessQueryReference,
>(
  config: ConvexApiAuthLookupAdapterConfig<
    TUserIdentityQueryReference,
    TOrganizationAccessQueryReference
  >,
): ApiAuthLookupAdapter {
  return {
    async getUserByIdentity(args: UserIdentityLookupArgs): Promise<UserIdentityLookupResult> {
      return await config.runUserIdentityQuery(config.refs.getUserByIdentity, args);
    },
    async getOrganizationAccess(
      args: OrganizationAccessLookupArgs,
    ): Promise<OrganizationAccessLookupResult> {
      return await config.runOrganizationAccessQuery(config.refs.getOrganizationAccess, args);
    },
    getApiKeyPrincipal: config.getApiKeyPrincipal,
  };
}
