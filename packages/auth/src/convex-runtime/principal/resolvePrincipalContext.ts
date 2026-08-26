import type {
  AgentPrincipal,
  ApiKeyPrincipal,
  AuthPrincipal,
  OAuthClientPrincipal,
  ResolvedAuthContext,
  ServicePrincipal,
  UserPrincipal,
} from "../coreTypes";
import { resolveExecutionContext } from "./resolveExecutionContext";
import type { PrincipalResolutionInput } from "./types";

export function resolvePrincipalContext(
  principal: AuthPrincipal,
  input: PrincipalResolutionInput,
): ResolvedAuthContext {
  return {
    principal,
    execution: resolveExecutionContext(input),
  };
}

export function resolveAnonymousContext(
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(
    {
      kind: "anonymous",
      permissions: [],
    },
    {
      credentialType: "anonymous",
      ...input,
    },
  );
}

export function resolveUserContext(
  principal: UserPrincipal,
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(principal, {
    credentialType: "userToken",
    organizationId: input.organizationId ?? principal.activeOrganizationId,
    ...input,
  });
}

export function resolveServiceContext(
  principal: ServicePrincipal,
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(principal, {
    credentialType: "serviceCredential",
    organizationId: input.organizationId ?? principal.organizationId,
    ...input,
  });
}

export function resolveAgentContext(
  principal: AgentPrincipal,
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(principal, {
    ...input,
    credentialType: "agentCredential",
    organizationId: principal.organizationId,
  });
}

export function resolveApiKeyContext(
  principal: ApiKeyPrincipal,
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(principal, {
    credentialType: "apiKey",
    organizationId: input.organizationId ?? principal.organizationId,
    ...input,
  });
}

export function resolveOAuthClientContext(
  principal: OAuthClientPrincipal,
  input: Omit<PrincipalResolutionInput, "credentialType">,
): ResolvedAuthContext {
  return resolvePrincipalContext(principal, {
    credentialType: "oauthToken",
    organizationId: input.organizationId ?? principal.organizationId,
    audience: input.audience ?? principal.audience,
    scopes: input.scopes ?? principal.scopes,
    ...input,
  });
}
