import type { ApiResolvedAuthContext } from "../coreTypes";
import { resolveOAuthClientContext, resolveOAuthClientPrincipal } from "../principal";
import { ApiAuthError } from "./errors";

export type McpSessionLike = {
  accessToken?: string | null;
  accessTokenExpiresAt?: string | Date | null;
  clientId?: string | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | Date | null;
  scopes?: string | readonly string[] | null;
  userId?: string | null;
};

export type ResolveMcpSessionAuthContextArgs = {
  session: McpSessionLike | null | undefined;
  audience?: string | null;
  clientId?: string | null;
  isRestricted?: boolean;
  organizationId?: string | null;
  permissions?: readonly string[];
  resourceId?: string | null;
  resourceType?: string | null;
  restrictedReason?: string | null;
  subjectId?: string | null;
  subjectType?: "user" | "service" | "client";
};

export function resolveMcpSessionAuthContext(
  args: ResolveMcpSessionAuthContextArgs,
): ApiResolvedAuthContext {
  const session = args.session;
  if (session === null || session === undefined) {
    throw new ApiAuthError("OAUTH_SESSION_INVALID", "MCP session is missing.");
  }

  const clientId = readRequiredString(args.clientId ?? session.clientId, "clientId");
  const scopes = normalizeMcpSessionScopes(session.scopes);
  const subjectId = readOptionalString(args.subjectId ?? session.userId);
  const subjectType = args.subjectType ?? (subjectId === null ? "client" : "user");
  const permissions = Array.from(args.permissions ?? []);

  const principal = resolveOAuthClientPrincipal({
    clientId,
    subjectType,
    subjectId,
    organizationId: args.organizationId ?? null,
    audience: args.audience ?? null,
    scopes,
    permissions,
    isRestricted: args.isRestricted,
    restrictedReason: args.restrictedReason,
  });

  if (principal.isRestricted) {
    throw new ApiAuthError(
      "PRINCIPAL_RESTRICTED",
      principal.restrictedReason ?? "Resolved OAuth client principal is restricted.",
    );
  }

  const context = resolveOAuthClientContext(principal, {
    organizationId: args.organizationId,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    audience: args.audience,
    scopes,
  });

  return {
    credentialType: "oauthToken",
    principal: context.principal,
    execution: context.execution,
    userId: subjectType === "user" ? subjectId : null,
    organizationId: args.organizationId ?? null,
    permissions,
    scopes,
  };
}

export function normalizeMcpSessionScopes(scopes: McpSessionLike["scopes"]): string[] {
  if (typeof scopes === "string") {
    return scopes
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);
  }

  if (Array.isArray(scopes)) {
    return Array.from(
      new Set(scopes.map((scope) => scope.trim()).filter((scope) => scope.length > 0)),
    );
  }

  return [];
}

function readRequiredString(value: string | null | undefined, field: string): string {
  const trimmed = readOptionalString(value);
  if (trimmed === null) {
    throw new ApiAuthError("OAUTH_SESSION_INVALID", `MCP session is missing ${field}.`);
  }

  return trimmed;
}

function readOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
