export type ApiScopeAuthorizationDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: "missing_api_key_scope" | "missing_user_permission";
    };

export function resolveApiScopeAuthorization<Scope extends string>(args: {
  authType: "jwt" | "api_key" | "oauth";
  scopes: readonly string[];
  role: string;
  permissions: readonly string[];
  requiredScope: Scope;
  fullAccessRoles?: readonly string[];
  canUserUseScope: (permissions: readonly string[], scope: Scope) => boolean;
}): ApiScopeAuthorizationDecision {
  if (
    (args.authType === "api_key" || args.authType === "oauth") &&
    !args.scopes.includes(args.requiredScope)
  ) {
    return { allowed: false, reason: "missing_api_key_scope" };
  }

  if (args.authType === "jwt" && (args.fullAccessRoles ?? ["owner", "admin"]).includes(args.role)) {
    return { allowed: true };
  }

  if (!args.canUserUseScope(args.permissions, args.requiredScope)) {
    return { allowed: false, reason: "missing_user_permission" };
  }

  return { allowed: true };
}
