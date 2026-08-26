import type { ResolvedAuthContext } from "../coreTypes";
import {
  resolveAnonymousContext,
  resolveAgentContext,
  resolveApiKeyContext,
  resolveOAuthClientContext,
  resolveServiceContext,
  resolveUserContext,
} from "./resolvePrincipalContext";
import type { PrincipalResolutionRequest } from "./types";

export function resolvePrincipal(
  request: PrincipalResolutionRequest
): ResolvedAuthContext {
  switch (request.credentialType) {
    case "anonymous":
      return resolveAnonymousContext(request);
    case "userToken":
      return resolveUserContext(request.principal, request);
    case "agentCredential":
      return resolveAgentContext(request.principal, request);
    case "serviceCredential":
      return resolveServiceContext(request.principal, request);
    case "apiKey":
      return resolveApiKeyContext(request.principal, request);
    case "oauthToken":
      return resolveOAuthClientContext(request.principal, request);
    default:
      throw new TypeError("Unsupported principal credential type");
  }
}
