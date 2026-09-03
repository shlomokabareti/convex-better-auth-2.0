import { validateTokenEndpointClientAuthentication } from "./clientAuth";
import type {
  McpOAuthClient,
  McpOAuthRefreshTokenFamilyRevocationReason,
  McpOAuthRefreshTokenGrantFailure,
  McpOAuthRefreshTokenGrantRequest,
  McpOAuthRefreshTokenGrantSuccess,
  McpOAuthRefreshTokenHashResult,
  McpOAuthRefreshTokenIssueArgs,
  McpOAuthRefreshTokenIssueResult,
  McpOAuthRefreshTokenPolicy,
  McpOAuthRefreshTokenRecord,
  McpOAuthRefreshTokenRedeemFailure,
  McpOAuthRefreshTokenRedeemResult,
  McpOAuthRefreshTokenResolveScopesFailure,
  McpOAuthRefreshTokenResolveScopesSuccess,
  McpOAuthRefreshTokenRotateArgs,
  McpOAuthRefreshTokenRotateResult,
  McpOAuthRefreshTokenStatus,
  McpOAuthRefreshTokenStorageAdapter,
} from "./types";

export async function hashMcpOAuthRefreshToken(
  refreshToken: string,
): Promise<McpOAuthRefreshTokenHashResult> {
  const data = new TextEncoder().encode(refreshToken);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return {
    tokenHash: Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export function createMcpOAuthRefreshTokenPolicy(input: {
  absoluteLifetimeMs: number;
  inactivityLifetimeMs?: number | null;
}): McpOAuthRefreshTokenPolicy {
  if (!Number.isFinite(input.absoluteLifetimeMs) || input.absoluteLifetimeMs <= 0) {
    throw new Error("absoluteLifetimeMs must be a positive number");
  }
  if (
    input.inactivityLifetimeMs !== undefined &&
    input.inactivityLifetimeMs !== null &&
    (!Number.isFinite(input.inactivityLifetimeMs) || input.inactivityLifetimeMs <= 0)
  ) {
    throw new Error("inactivityLifetimeMs must be a positive number when provided");
  }

  return {
    absoluteLifetimeMs: input.absoluteLifetimeMs,
    inactivityLifetimeMs: input.inactivityLifetimeMs ?? null,
  };
}

export function createMcpOAuthRefreshToken(
  args: McpOAuthRefreshTokenIssueArgs,
): McpOAuthRefreshTokenIssueResult {
  const now = args.now ?? Date.now();
  const policy = createMcpOAuthRefreshTokenPolicy(args.policy);
  const tokenId = args.tokenId ?? `rt_${crypto.randomUUID()}`;
  const familyId = args.familyId ?? tokenId;

  return {
    refreshToken: args.refreshToken ?? `mcp_refresh_${crypto.randomUUID()}`,
    record: {
      tokenId,
      familyId,
      parentTokenId: args.parentTokenId ?? null,
      clientId: args.clientId,
      subjectId: args.subjectId,
      organizationId: args.organizationId,
      scopes: Array.from(new Set(args.scopes)),
      audience: args.audience,
      resourceId: args.resourceId,
      issuedAt: now,
      expiresAt: now + policy.absoluteLifetimeMs,
      inactivityExpiresAt:
        policy.inactivityLifetimeMs === null ? null : now + policy.inactivityLifetimeMs,
      consumedAt: null,
      revokedAt: null,
      replacedByTokenId: null,
    },
  };
}

export function rotateMcpOAuthRefreshToken(
  args: McpOAuthRefreshTokenRotateArgs,
): McpOAuthRefreshTokenRotateResult {
  const now = args.now ?? Date.now();
  const next = createMcpOAuthRefreshToken({
    clientId: args.record.clientId,
    subjectId: args.record.subjectId,
    organizationId: args.record.organizationId,
    scopes: args.scopes ?? args.record.scopes,
    audience: args.record.audience,
    resourceId: args.record.resourceId,
    policy: args.policy,
    now,
    refreshToken: args.refreshToken,
    tokenId: args.tokenId,
    familyId: args.record.familyId,
    parentTokenId: args.record.tokenId,
  });

  return {
    refreshToken: next.refreshToken,
    record: next.record,
    consumedRecordPatch: {
      consumedAt: now,
      replacedByTokenId: next.record.tokenId,
    },
  };
}

export async function validateMcpOAuthRefreshTokenGrantRequest<
  TClient extends McpOAuthClient,
>(args: {
  request: Request;
  resolveClient: (clientId: string) => Promise<TClient | null> | TClient | null;
}): Promise<McpOAuthRefreshTokenGrantFailure | McpOAuthRefreshTokenGrantSuccess<TClient>> {
  const parsed = await parseMcpOAuthRefreshTokenGrantRequest(args.request);

  const clientAuthenticationError = validateTokenEndpointClientAuthentication({
    authorizationHeader: parsed.authorizationHeader,
    clientSecret: parsed.clientSecret,
  });
  if (clientAuthenticationError !== null) {
    return {
      ok: false,
      status: 400,
      body: clientAuthenticationError,
    };
  }

  if (parsed.grantType !== "refresh_token") {
    return {
      ok: false,
      status: 400,
      body: {
        error: "unsupported_grant_type",
        error_description: "Only refresh_token is supported",
      },
    };
  }

  if (parsed.refreshToken === null || parsed.clientId === null) {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_request" },
    };
  }

  const client = await args.resolveClient(parsed.clientId);
  if (client === null) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_client",
        error_description: "Unknown OAuth client",
      },
    };
  }

  const requestedScopes = normalizeScope(parsed.scope);
  const invalidRequestedScope = requestedScopes.find(
    (scope) => !client.allowedScopes.includes(scope),
  );
  if (invalidRequestedScope !== undefined) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_scope",
        error_description: `Unsupported scope: ${invalidRequestedScope}`,
      },
    };
  }

  return {
    ok: true,
    client,
    refreshToken: parsed.refreshToken,
    requestedScopes,
  };
}

export function resolveMcpOAuthRefreshTokenGrantedScopes(args: {
  client: McpOAuthClient;
  refreshTokenRecord: Pick<McpOAuthRefreshTokenRecord, "scopes">;
  requestedScopes?: readonly string[] | null;
}): McpOAuthRefreshTokenResolveScopesFailure | McpOAuthRefreshTokenResolveScopesSuccess {
  const tokenScopes = Array.from(new Set(args.refreshTokenRecord.scopes));
  const requestedScopes = Array.from(new Set(args.requestedScopes ?? []));

  const invalidTokenScope = tokenScopes.find((scope) => !args.client.allowedScopes.includes(scope));
  if (invalidTokenScope !== undefined) {
    return {
      ok: false,
      error: "invalid_scope",
      error_description: `Stored refresh token scope is no longer allowed for client: ${invalidTokenScope}`,
    };
  }

  if (requestedScopes.length === 0) {
    return {
      ok: true,
      scopes: tokenScopes,
    };
  }

  const invalidRequestedScope = requestedScopes.find((scope) => !tokenScopes.includes(scope));
  if (invalidRequestedScope !== undefined) {
    return {
      ok: false,
      error: "invalid_scope",
      error_description: `Requested scope exceeds originally granted scope: ${invalidRequestedScope}`,
    };
  }

  return {
    ok: true,
    scopes: requestedScopes,
  };
}

export async function redeemMcpOAuthRefreshToken<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
>(args: {
  client: McpOAuthClient;
  refreshToken: string;
  requestedScopes?: readonly string[] | null;
  policy: McpOAuthRefreshTokenPolicy;
  storage: McpOAuthRefreshTokenStorageAdapter<TRecord>;
  now?: number;
  nextRefreshToken?: string;
  nextTokenId?: string;
}): Promise<McpOAuthRefreshTokenRedeemResult<TRecord>> {
  const now = args.now ?? Date.now();
  const record = await args.storage.findForRefreshToken({
    refreshToken: args.refreshToken,
    clientId: args.client.clientId,
  });

  if (record === null) {
    return invalidGrantFailure("not_found");
  }

  const status = getMcpOAuthRefreshTokenStatus(record, now);
  if (status === "consumed") {
    return await revokeFamilyAndFail({
      storage: args.storage,
      familyId: record.familyId,
      now,
      reason: "replay_detected",
      errorDescription: "Refresh token reuse detected",
    });
  }
  if (status === "revoked") {
    return invalidGrantFailure("revoked");
  }
  if (status === "expired") {
    return invalidGrantFailure("expired");
  }
  if (status === "inactive") {
    return invalidGrantFailure("inactive");
  }

  const scopeResolution = resolveMcpOAuthRefreshTokenGrantedScopes({
    client: args.client,
    refreshTokenRecord: record,
    requestedScopes: args.requestedScopes,
  });
  if (!scopeResolution.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        error: scopeResolution.error,
        error_description: scopeResolution.error_description,
      },
      reason: "invalid_scope",
    };
  }

  const rotation = rotateMcpOAuthRefreshToken({
    record,
    policy: args.policy,
    now,
    refreshToken: args.nextRefreshToken,
    tokenId: args.nextTokenId,
    scopes: scopeResolution.scopes,
  });

  const persisted = await args.storage.rotate({
    currentRecord: record,
    currentRefreshToken: args.refreshToken,
    nextRecord: rotation.record,
    nextRefreshToken: rotation.refreshToken,
    consumedRecordPatch: rotation.consumedRecordPatch,
  });

  if (!persisted.ok) {
    return await revokeFamilyAndFail({
      storage: args.storage,
      familyId: record.familyId,
      now,
      reason: "concurrent_conflict",
      errorDescription: "Refresh token already used",
    });
  }

  return {
    ok: true,
    record,
    scopes: scopeResolution.scopes,
    rotation,
  };
}

export function getMcpOAuthRefreshTokenStatus(
  record: Pick<
    McpOAuthRefreshTokenRecord,
    "expiresAt" | "inactivityExpiresAt" | "consumedAt" | "revokedAt"
  >,
  now: number,
): McpOAuthRefreshTokenStatus {
  if (record.revokedAt !== null && record.revokedAt !== undefined) {
    return "revoked";
  }
  if (record.expiresAt <= now) {
    return "expired";
  }
  if (
    record.inactivityExpiresAt !== null &&
    record.inactivityExpiresAt !== undefined &&
    record.inactivityExpiresAt <= now
  ) {
    return "inactive";
  }
  if (record.consumedAt !== null && record.consumedAt !== undefined) {
    return "consumed";
  }
  return "active";
}

async function parseMcpOAuthRefreshTokenGrantRequest(
  request: Request,
): Promise<McpOAuthRefreshTokenGrantRequest> {
  const params = new URLSearchParams(await request.text());

  return {
    grantType: getOptionalSearchParam(params, "grant_type"),
    refreshToken: getOptionalSearchParam(params, "refresh_token"),
    clientId: getOptionalSearchParam(params, "client_id"),
    clientSecret: getOptionalSearchParam(params, "client_secret"),
    scope: getOptionalSearchParam(params, "scope"),
    authorizationHeader: request.headers.get("authorization"),
  };
}

function getOptionalSearchParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

function normalizeScope(scope: string | null): string[] {
  return Array.from(
    new Set(
      (scope ?? "")
        .split(/\s+/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function invalidGrantFailure(
  reason: Exclude<
    McpOAuthRefreshTokenRedeemFailure["reason"],
    "invalid_scope" | "replay_detected" | "concurrent_conflict"
  >,
): McpOAuthRefreshTokenRedeemFailure {
  return {
    ok: false,
    status: 400,
    body: { error: "invalid_grant" },
    reason,
  };
}

async function revokeFamilyAndFail<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
>(args: {
  storage: McpOAuthRefreshTokenStorageAdapter<TRecord>;
  familyId: string;
  now: number;
  reason: McpOAuthRefreshTokenFamilyRevocationReason;
  errorDescription: string;
}): Promise<McpOAuthRefreshTokenRedeemFailure> {
  const familyRevocation = {
    familyId: args.familyId,
    revokedAt: args.now,
    reason: args.reason,
  } as const;

  await args.storage.revokeFamily?.(familyRevocation);

  return {
    ok: false,
    status: 400,
    body: {
      error: "invalid_grant",
      error_description: args.errorDescription,
    },
    reason: args.reason,
    familyRevocation,
  };
}
