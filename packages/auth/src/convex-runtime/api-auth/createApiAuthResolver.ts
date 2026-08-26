import { hasPermission } from "../../compat/permissions";

import type { ApiResolvedAuthContext } from "../coreTypes";
import { resolveApiKeyPrincipal } from "../principal";
import { ApiAuthError } from "./errors";
import { resolveApiAuthContext } from "./resolveApiAuthContext";
import { parseApiCredentialFromHeaders } from "./resolveApiAuthContextFromRequest";
import {
  resolveAuthorizedApiAuthContext,
  type AuthorizedApiAuthContext,
  type AuthorizedApiAuthType,
} from "./resolveAuthorizedApiAuthContext";
import { resolveLinkedBetterAuthMcpSession } from "./resolveLinkedBetterAuthMcpSession";
import type { McpSessionLike } from "./resolveMcpSessionAuthContext";
import { resolveVerifiedUserBearerAuthContext } from "./resolveVerifiedUserBearerAuthContext";
import { resolveApiScopeAuthorization } from "./scopeAuthorization";
import type { ApiAuthLookupAdapter, ApiTokenVerifier } from "./types";

/**
 * The single, package-owned default session full-access policy. Applies to JWT
 * (session) principals ONLY. api_key/oauth principals are NEVER granted
 * role-based full access — see {@link createApiAuthResolver}.
 */
const DEFAULT_SESSION_FULL_ACCESS_ROLES: readonly string[] = ["owner", "admin"];

/**
 * The api-key row a consumer resolves for an incoming key token. The resolver
 * builds the principal and applies the live-membership permission ceiling itself,
 * so the consumer only supplies identity/scope plumbing — never permissions.
 */
export type ApiKeyRecordResolution<
  TUserId extends string = string,
  TOrgId extends string = string,
> = {
  apiKeyId: string;
  ownerUserId: TUserId;
  organizationId: TOrgId;
  scopes: string[];
  requestIp: string | null;
};

export type ApiAuthResolverApiKeyConfig<
  TCtx,
  TUserId extends string = string,
  TOrgId extends string = string,
> = {
  /** Token prefixes that identify an api-key bearer (vs. a user JWT). */
  tokenPrefixes: readonly string[];
  /** Look up and validate the stored api-key row for the presented token. */
  resolveRecord: (
    ctx: TCtx,
    args: { token: string; request: Request }
  ) => Promise<ApiKeyRecordResolution<TUserId, TOrgId>>;
  /** Optional side effect after a key authorizes (e.g. touch last-used). */
  onResolved?: (
    ctx: TCtx,
    args: { apiKeyId: string; requestIp: string | null }
  ) => Promise<void>;
};

export type ApiAuthResolverMcpConfig<TCtx> = {
  provider: string | ((ctx: TCtx) => string);
  getIssuer: (ctx: TCtx) => string;
  buildTokenIdentifier: (subject: string, issuer: string) => string;
  audience?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
};

export type CreateApiAuthResolverConfig<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string = string,
  TOrgId extends string = string,
> = {
  /** The user-bearer token verifier (JWT path). */
  getVerifier: () => ApiTokenVerifier;
  /** Build the identity/organization lookup adapter bound to the runtime ctx. */
  createAdapter: (
    ctx: TCtx
  ) => Pick<
    ApiAuthLookupAdapter,
    "getUserByIdentity" | "getOrganizationAccess"
  >;
  /**
   * The ONLY authorization decision a consumer owns: given a resolved principal,
   * return the LIVE membership role + permissions for the org, or null to deny.
   * This live lookup is the permission ceiling — stale tokens fail closed here.
   */
  authorizeOrganizationAccess: (
    ctx: TCtx,
    args: {
      auth: ApiResolvedAuthContext;
      userId: TUserId;
      organizationId: TOrgId;
    }
  ) => Promise<{ role: TRole; permissions: string[] } | null>;
  /** Map a permission set to a scope decision (consumer domain rule). */
  canUseScope: (permissions: readonly string[], scope: Scope) => boolean;
  /** Validate and convert an auth-layer string into the consumer's user id type. */
  parseUserId: (value: string) => TUserId;
  /** Validate and convert an auth-layer string into the consumer's organization id type. */
  parseOrganizationId: (value: string) => TOrgId;
  /**
   * Roles that get role-based full access for JWT (session) principals ONLY.
   * Defaults to ["owner", "admin"]. There is intentionally NO knob to grant
   * api_key/oauth principals full access — they are always bound by their scope
   * set. A consumer cannot author a permissive token ceiling.
   */
  sessionFullAccessRoles?: readonly string[];
  resolveRequestedOrganizationId?: (ctx: TCtx) => Promise<TOrgId | null>;
  resourceType?: string | null;
  resourceId?: string | null;
  apiKey?: ApiAuthResolverApiKeyConfig<TCtx, TUserId, TOrgId>;
  mcp?: ApiAuthResolverMcpConfig<TCtx>;
};

export type ResolvedApiAuthScopeContext<
  Scope extends string,
  TRole extends string,
  TUserId extends string = string,
  TOrgId extends string = string,
> = {
  authType: AuthorizedApiAuthType;
  scopes: string[];
  userId: TUserId;
  organizationId: TOrgId;
  authSubject: string;
  role: TRole;
  permissions: string[];
  hasScope: (scope: Scope) => boolean;
  hasPermission: (permission: string) => boolean;
};

export type ApiAuthResolverMcpArgs<TOrgId extends string = string> = {
  session: McpSessionLike | null | undefined;
  requestedOrganizationId?: TOrgId | null;
  resourceType?: string;
  resourceId?: string;
  audience?: string | null;
};

export type ApiAuthResolverInstance<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string = string,
  TOrgId extends string = string,
> = {
  resolveApiAuth(
    ctx: TCtx,
    request: Request
  ): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>>;
  resolveMcpAuth(
    ctx: TCtx,
    args: ApiAuthResolverMcpArgs<TOrgId>
  ): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>>;
  requireScope(
    auth: ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>,
    scope: Scope
  ): void;
};

/**
 * Higher-level api/MCP auth resolver that bakes the scope-ceiling bypass policy
 * and the live-membership permission model ONCE, at construction.
 *
 * The invariant this enforces: api_key/oauth principals can NEVER bypass their
 * scope set, and the live-membership permission ceiling always also applies.
 * Only JWT (session) principals may receive role-based full access. The
 * session-vs-token policy is not a per-call-site argument and is not
 * configurable to "bypass" for tokens — making a permissive token ceiling
 * unexpressible by a consumer, by construction.
 */
export function createApiAuthResolver<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string = string,
  TOrgId extends string = string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>
): ApiAuthResolverInstance<TCtx, Scope, TRole, TUserId, TOrgId> {
  const sessionFullAccessRoles =
    config.sessionFullAccessRoles ?? DEFAULT_SESSION_FULL_ACCESS_ROLES;

  return {
    async resolveApiAuth(ctx, request) {
      const credential = parseApiCredentialFromHeaders({
        request,
        apiKeyTokenPrefixes: config.apiKey?.tokenPrefixes ?? [],
      });

      if (credential.credentialType === "apiKeyBearer") {
        return await resolveApiKeyAuth(config, ctx, credential.token, request);
      }

      return await resolveJwtAuth(config, ctx, credential.token);
    },

    async resolveMcpAuth(ctx, args) {
      return await resolveMcpApiAuth(config, ctx, args);
    },

    requireScope(auth, scope) {
      requireResolvedApiScope(config, sessionFullAccessRoles, auth, scope);
    },
  };
}

function toApiScopeContext<
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  resolved: AuthorizedApiAuthContext<TRole>,
  parseUserId: (value: string) => TUserId,
  parseOrganizationId: (value: string) => TOrgId
): ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId> {
  const scopes = resolved.scopes;
  const permissions = resolved.permissions;
  return {
    authType: resolved.authType,
    scopes,
    userId: parseUserId(resolved.userId),
    organizationId: parseOrganizationId(resolved.organizationId),
    authSubject: resolved.authSubject,
    role: resolved.role,
    permissions,
    hasScope: (scope) => scopes.includes(scope),
    hasPermission: (permission) => hasPermission(permissions, permission),
  };
}

async function authorizeApiAuthContext<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>,
  ctx: TCtx,
  args: {
    auth: ApiResolvedAuthContext;
    authType: AuthorizedApiAuthType;
    authSubject: string;
    userId?: string | null;
    organizationId?: string | null;
  }
): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>> {
  const resolved = await resolveAuthorizedApiAuthContext<TRole>({
    auth: args.auth,
    authType: args.authType,
    authSubject: args.authSubject,
    userId: args.userId,
    organizationId: args.organizationId,
    authorizeOrganizationAccess: async ({ auth, userId, organizationId }) =>
      await config.authorizeOrganizationAccess(ctx, {
        auth,
        userId: config.parseUserId(userId),
        organizationId: config.parseOrganizationId(organizationId),
      }),
  });

  if (resolved === null) {
    throw new ApiAuthError(
      "ORGANIZATION_ACCESS_DENIED",
      "No active organization access for the resolved principal."
    );
  }

  return toApiScopeContext(
    resolved,
    config.parseUserId,
    config.parseOrganizationId
  );
}

async function resolveJwtAuth<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>,
  ctx: TCtx,
  token: string
): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>> {
  const requestedOrganizationId =
    config.resolveRequestedOrganizationId === undefined
      ? null
      : await config.resolveRequestedOrganizationId(ctx);

  const { context, verifiedToken } = await resolveVerifiedUserBearerAuthContext(
    {
      token,
      requestedOrganizationId,
      verifier: config.getVerifier(),
      adapter: config.createAdapter(ctx),
      resourceType: config.resourceType,
      resourceId: config.resourceId,
    }
  );

  return await authorizeApiAuthContext(config, ctx, {
    auth: context,
    authType: "jwt",
    authSubject: verifiedToken.subject,
  });
}

async function resolveApiKeyAuth<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>,
  ctx: TCtx,
  token: string,
  request: Request
): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>> {
  const apiKeyConfig = requireApiKeyResolverConfig(config);
  const touchState = {
    current: null as { apiKeyId: string; requestIp: string | null } | null,
  };
  const resolved = await resolveApiAuthContext({
    credential: { credentialType: "apiKeyBearer", token },
    requestIp: null,
    verifier: config.getVerifier(),
    adapter: {
      ...config.createAdapter(ctx),
      getApiKeyPrincipal: async ({ token: apiKeyToken }) =>
        await resolvePackageOwnedApiKeyPrincipal(
          ctx,
          request,
          apiKeyConfig,
          apiKeyToken,
          touchState
        ),
    },
    resourceType: config.resourceType,
    resourceId: config.resourceId,
  });
  const authorized = await authorizeApiAuthContext(config, ctx, {
    auth: resolved,
    authType: "api_key",
    authSubject: resolved.userId ?? "api_key",
  });

  if (touchState.current !== null && apiKeyConfig.onResolved !== undefined) {
    await apiKeyConfig.onResolved(ctx, touchState.current);
  }

  return authorized;
}

function requireApiKeyResolverConfig<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>
): ApiAuthResolverApiKeyConfig<TCtx, TUserId, TOrgId> {
  if (config.apiKey !== undefined) {
    return config.apiKey;
  }

  throw new ApiAuthError(
    "API_CREDENTIAL_UNSUPPORTED",
    "API key credentials are not configured for this resolver."
  );
}

async function resolvePackageOwnedApiKeyPrincipal<
  TCtx,
  TUserId extends string,
  TOrgId extends string,
>(
  ctx: TCtx,
  request: Request,
  apiKeyConfig: ApiAuthResolverApiKeyConfig<TCtx, TUserId, TOrgId>,
  apiKeyToken: string,
  touchState: { current: { apiKeyId: string; requestIp: string | null } | null }
) {
  const record = await apiKeyConfig.resolveRecord(ctx, {
    token: apiKeyToken,
    request,
  });
  touchState.current = {
    apiKeyId: record.apiKeyId,
    requestIp: record.requestIp,
  };

  return {
    principal: resolveApiKeyPrincipal({
      apiKeyId: record.apiKeyId,
      ownerType: "user",
      ownerId: record.ownerUserId,
      fixedOrganizationId: record.organizationId,
      permissions: null,
      ownerPermissions: [],
    }),
    userId: record.ownerUserId,
    organizationId: record.organizationId,
    permissions: [],
    scopes: record.scopes,
  };
}

async function resolveMcpApiAuth<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>,
  ctx: TCtx,
  args: ApiAuthResolverMcpArgs<TOrgId>
): Promise<ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>> {
  const mcpConfig = requireMcpResolverConfig(config);
  const provider =
    typeof mcpConfig.provider === "function"
      ? mcpConfig.provider(ctx)
      : mcpConfig.provider;
  const resolved = await resolveLinkedBetterAuthMcpSession({
    session: args.session,
    provider,
    issuer: mcpConfig.getIssuer(ctx),
    buildTokenIdentifier: mcpConfig.buildTokenIdentifier,
    adapter: config.createAdapter(ctx),
    requestedOrganizationId: args.requestedOrganizationId ?? null,
    audience: args.audience ?? mcpConfig.audience ?? null,
    resourceType: args.resourceType ?? mcpConfig.resourceType ?? null,
    resourceId: args.resourceId ?? mcpConfig.resourceId ?? null,
  });

  return await authorizeApiAuthContext(config, ctx, {
    auth: resolved.provisionalContext,
    authType: "oauth",
    authSubject: resolved.betterAuthUserId,
    userId: resolved.userId,
    organizationId: resolved.organizationId,
  });
}

function requireMcpResolverConfig<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>
): ApiAuthResolverMcpConfig<TCtx> {
  if (config.mcp !== undefined) {
    return config.mcp;
  }

  throw new ApiAuthError(
    "API_CREDENTIAL_UNSUPPORTED",
    "MCP credentials are not configured for this resolver."
  );
}

function requireResolvedApiScope<
  TCtx,
  Scope extends string,
  TRole extends string,
  TUserId extends string,
  TOrgId extends string,
>(
  config: CreateApiAuthResolverConfig<TCtx, Scope, TRole, TUserId, TOrgId>,
  sessionFullAccessRoles: readonly string[],
  auth: ResolvedApiAuthScopeContext<Scope, TRole, TUserId, TOrgId>,
  scope: Scope
): void {
  const decision = resolveApiScopeAuthorization<Scope>({
    authType: auth.authType,
    scopes: auth.scopes,
    role: auth.role,
    permissions: auth.permissions,
    requiredScope: scope,
    fullAccessRoles: auth.authType === "jwt" ? sessionFullAccessRoles : [],
    canUserUseScope: config.canUseScope,
  });

  if (!decision.allowed) {
    throw new ApiAuthError(
      "SCOPE_FORBIDDEN",
      `Missing required scope: ${scope}`
    );
  }
}
