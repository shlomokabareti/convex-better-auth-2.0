import type { AuthPrincipal, ResolvedAuthContext } from "../coreTypes";

export function principalIdForAuthPrincipal(
  principal: AuthPrincipal
): string | null {
  switch (principal.kind) {
    case "anonymous":
      return null;
    case "user":
      return principal.userId;
    case "service":
      return principal.serviceId;
    case "agent":
      return principal.agentId;
    case "apiKey":
      return principal.apiKeyId;
    case "oauthClient":
      return principal.clientId;
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

export function principalIdForAuditContext(
  context: ResolvedAuthContext
): string | null {
  return principalIdForAuthPrincipal(context.principal);
}
