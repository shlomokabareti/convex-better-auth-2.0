import { hasPermission } from "../../compat/permissions";

import type { AuthPrincipal, ResolvedAuthContext } from "../coreTypes";
import type { AuthorizationDecision, AuthorizationFailureCode } from "./types";

export function authorizeAuthenticated(context: ResolvedAuthContext): AuthorizationDecision {
  if (context.principal.kind === "anonymous") {
    return deny("AUTHENTICATION_REQUIRED", "Authentication required");
  }

  return allow();
}

export function sessionRequiredDecision(): AuthorizationDecision {
  return deny("SESSION_REQUIRED", "Active session required");
}

export function authorizeNotRestricted(context: ResolvedAuthContext): AuthorizationDecision {
  const reason = principalRestrictionReason(context.principal);
  if (reason !== null) {
    return deny("PRINCIPAL_RESTRICTED", reason);
  }

  return allow();
}

export function authorizeOrganization(context: ResolvedAuthContext): AuthorizationDecision {
  if (context.execution.organizationId === null) {
    return deny("ORGANIZATION_REQUIRED", "Organization context required");
  }

  return allow();
}

export function authorizePermission(
  context: ResolvedAuthContext,
  permission: string,
): AuthorizationDecision {
  const restrictionDecision = authorizeNotRestricted(context);
  if (!restrictionDecision.allowed) {
    return restrictionDecision;
  }

  if (!hasPermission(principalPermissions(context.principal), permission)) {
    return deny("PERMISSION_REQUIRED", `Permission required: ${permission}`);
  }

  return allow();
}

export function principalPermissions(principal: AuthPrincipal): string[] {
  switch (principal.kind) {
    case "anonymous":
      return principal.permissions;
    case "user":
      return principal.permissions;
    case "service":
    case "agent":
      return principal.permissions;
    case "apiKey":
      return principal.effectivePermissions;
    case "oauthClient":
      return principal.permissions;
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

export function principalRestrictionReason(principal: AuthPrincipal): string | null {
  switch (principal.kind) {
    case "anonymous":
      return null;
    case "user":
      return principal.isRestricted
        ? (principal.restrictedReason ?? "Principal is restricted")
        : null;
    case "service":
    case "agent":
      return principal.isRestricted
        ? (principal.restrictedReason ?? "Principal is restricted")
        : null;
    case "apiKey":
      return principal.isRestricted
        ? (principal.restrictedReason ?? "Principal is restricted")
        : null;
    case "oauthClient":
      return principal.isRestricted
        ? (principal.restrictedReason ?? "Principal is restricted")
        : null;
    default:
      throw new TypeError("Unsupported auth principal kind");
  }
}

function allow(): AuthorizationDecision {
  return {
    allowed: true,
    reason: null,
    code: null,
  };
}

function deny(code: AuthorizationFailureCode, reason: string): AuthorizationDecision {
  return {
    allowed: false,
    reason,
    code,
  };
}
