import type { ApiResolvedAuthContext, AuthPrincipal, VerifiedUserToken } from "../coreTypes";
import {
  resolveAgentContext,
  resolveApiKeyContext,
  resolvePrincipalContext,
  resolveUserContext,
  resolveUserPrincipal,
} from "../principal";
import { ApiAuthError } from "./errors";
import type { ResolveApiAuthContextArgs } from "./types";

function isRestrictedPrincipal(principal: AuthPrincipal): boolean {
  switch (principal.kind) {
    case "user":
    case "service":
    case "agent":
    case "apiKey":
    case "oauthClient":
      return principal.isRestricted;
    case "anonymous":
      return false;
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

function getRestrictedReason(principal: AuthPrincipal): string | null {
  switch (principal.kind) {
    case "user":
    case "service":
    case "agent":
    case "apiKey":
    case "oauthClient":
      return principal.restrictedReason;
    case "anonymous":
      return null;
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

function resolveApiCredentialContext(args: {
  principal: AuthPrincipal;
  organizationId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  audience?: string | null;
  scopes: string[];
}): Pick<ApiResolvedAuthContext, "principal" | "execution"> {
  const input = {
    organizationId: args.organizationId,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    audience: args.audience,
    scopes: args.scopes,
  };

  switch (args.principal.kind) {
    case "user":
      return resolveUserContext(args.principal, input);
    case "apiKey":
      return resolveApiKeyContext(args.principal, input);
    case "service":
      return resolvePrincipalContext(args.principal, {
        credentialType: "serviceCredential",
        ...input,
      });
    case "agent":
      return resolveAgentContext(args.principal, input);
    case "oauthClient":
      return resolvePrincipalContext(args.principal, {
        credentialType: "oauthToken",
        ...input,
      });
    case "anonymous":
      return resolvePrincipalContext(args.principal, {
        credentialType: "anonymous",
        ...input,
      });
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

async function resolveUserBearerAuthContext(
  args: ResolveApiAuthContextArgs,
  verifiedToken: VerifiedUserToken,
): Promise<ApiResolvedAuthContext> {
  const linkedUser = await args.adapter.getUserByIdentity({
    provider: verifiedToken.provider,
    issuer: verifiedToken.issuer,
    subject: verifiedToken.subject,
    tokenIdentifier: verifiedToken.tokenIdentifier,
  });

  if (linkedUser === null) {
    throw new ApiAuthError(
      "USER_IDENTITY_NOT_LINKED",
      "Verified user token is not linked to a local user.",
    );
  }

  const organizationAccess = await args.adapter.getOrganizationAccess({
    userId: linkedUser.userId,
    requestedOrganizationId: args.requestedOrganizationId ?? null,
    organizationHintId: args.organizationHintId ?? linkedUser.activeOrganizationId,
  });

  const principal = resolveUserPrincipal({
    userId: linkedUser.userId,
    identity: linkedUser.identityId === null ? null : { identityId: linkedUser.identityId },
    activeOrganizationId: organizationAccess.organizationId,
    membershipIds: organizationAccess.membershipIds,
    roleKeys: organizationAccess.roleKeys,
    permissions: organizationAccess.permissions,
    sessionId: verifiedToken.sessionId,
    isRestricted: linkedUser.isRestricted,
    restrictedReason: linkedUser.restrictedReason,
  });

  if (principal.isRestricted) {
    throw new ApiAuthError(
      "PRINCIPAL_RESTRICTED",
      principal.restrictedReason ?? "Resolved principal is restricted.",
    );
  }

  const context = resolveUserContext(principal, {
    organizationId: organizationAccess.organizationId,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    audience: verifiedToken.audience,
    scopes: verifiedToken.scopes,
  });

  return {
    credentialType: "userBearer",
    principal: context.principal,
    execution: context.execution,
    userId: linkedUser.userId,
    organizationId: organizationAccess.organizationId,
    permissions: organizationAccess.permissions,
    scopes: verifiedToken.scopes,
  };
}

async function resolveApiKeyBearerAuthContext(
  args: ResolveApiAuthContextArgs,
): Promise<ApiResolvedAuthContext> {
  if (args.adapter.getApiKeyPrincipal === undefined) {
    throw new ApiAuthError(
      "API_CREDENTIAL_UNSUPPORTED",
      "API key bearer credentials are not configured for this adapter.",
    );
  }

  const resolvedApiKey = await args.adapter.getApiKeyPrincipal({
    token: args.credential.token,
    requestIp: args.requestIp ?? null,
  });

  if (resolvedApiKey === null) {
    throw new ApiAuthError("API_CREDENTIAL_INVALID", "API key bearer credential is invalid.");
  }

  if (isRestrictedPrincipal(resolvedApiKey.principal)) {
    throw new ApiAuthError(
      "PRINCIPAL_RESTRICTED",
      getRestrictedReason(resolvedApiKey.principal) ?? "Resolved principal is restricted.",
    );
  }

  const context = resolveApiCredentialContext({
    principal: resolvedApiKey.principal,
    organizationId: resolvedApiKey.organizationId,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    scopes: resolvedApiKey.scopes,
  });

  return {
    credentialType: "apiKeyBearer",
    principal: context.principal,
    execution: context.execution,
    userId: resolvedApiKey.userId,
    organizationId: resolvedApiKey.organizationId,
    permissions: resolvedApiKey.permissions,
    scopes: resolvedApiKey.scopes,
  };
}

export async function resolveApiAuthContext(
  args: ResolveApiAuthContextArgs,
): Promise<ApiResolvedAuthContext> {
  switch (args.credential.credentialType) {
    case "userBearer": {
      const verifiedToken = await verifyUserBearerToken(args);
      return resolveUserBearerAuthContext(args, verifiedToken);
    }
    case "apiKeyBearer":
      return resolveApiKeyBearerAuthContext(args);
    default:
      throw new TypeError("Unsupported API credential type");
  }
}

async function verifyUserBearerToken(args: ResolveApiAuthContextArgs): Promise<VerifiedUserToken> {
  try {
    return await args.verifier.verifyUserBearerToken(args.credential.token);
  } catch (error) {
    throw new ApiAuthError("API_CREDENTIAL_INVALID", "User bearer credential is invalid.", {
      cause: error,
    });
  }
}
