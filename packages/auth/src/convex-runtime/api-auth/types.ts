import type { ApiResolvedAuthContext, AuthPrincipal, VerifiedUserToken } from "../coreTypes";

export type ApiBearerCredential = {
  credentialType: "userBearer" | "apiKeyBearer";
  token: string;
};

export type ApiTokenVerifier = {
  verifyUserBearerToken(token: string): Promise<VerifiedUserToken>;
};

export type ApiAuthLookupAdapter = {
  getUserByIdentity(args: {
    provider: string;
    issuer: string;
    subject: string;
    tokenIdentifier: string;
  }): Promise<{
    userId: string;
    identityId: string | null;
    activeOrganizationId: string | null;
    membershipIds: string[];
    roleKeys: string[];
    permissions: string[];
    isRestricted: boolean;
    restrictedReason: string | null;
  } | null>;

  getOrganizationAccess(args: {
    userId: string;
    requestedOrganizationId: string | null;
    organizationHintId: string | null;
  }): Promise<{
    organizationId: string | null;
    membershipIds: string[];
    roleKeys: string[];
    permissions: string[];
  }>;

  getApiKeyPrincipal?(args: { token: string; requestIp: string | null }): Promise<{
    principal: AuthPrincipal;
    userId: string | null;
    organizationId: string | null;
    permissions: string[];
    scopes: string[];
  } | null>;
};

export type ResolveApiAuthContextArgs = {
  credential: ApiBearerCredential;
  requestIp?: string | null;
  requestedOrganizationId?: string | null;
  organizationHintId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  verifier: ApiTokenVerifier;
  adapter: ApiAuthLookupAdapter;
};

export type ApiAuthResolver = (args: ResolveApiAuthContextArgs) => Promise<ApiResolvedAuthContext>;
