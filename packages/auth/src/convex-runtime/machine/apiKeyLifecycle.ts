import { v, type GenericValidator } from "convex/values";

export const defaultApiKeyCreateReplayWindowMs = 10 * 60 * 1000;
export const defaultApiKeyRequestIdMaxLength = 200;

export type ApiKeyRequestIdResult =
  | {
      ok: true;
      requestId: string | undefined;
    }
  | {
      ok: false;
      reason: "too_long";
    };

export type ConvexApiKeyCreateInput<Scope extends string = string> = {
  name: string;
  scopes: Scope[];
  allowedIpRanges: string[];
  expiresAt?: number;
  requestId?: string;
};

export type ConvexApiKeyNormalizedCreateInput<Scope extends string = string> =
  ConvexApiKeyCreateInput<Scope> & {
    requestIdExpiresAt?: number;
  };

export type ConvexApiKeyCreateInputResult<Scope extends string = string> =
  | {
      ok: true;
      input: ConvexApiKeyNormalizedCreateInput<Scope>;
    }
  | {
      ok: false;
      reason: "empty_name" | "empty_scopes" | "request_id_too_long" | "expires_at_not_future";
    };

export type ConvexApiKeyReplayRecord = {
  name: string;
  scopes: readonly string[];
  allowedIpRanges?: readonly string[] | null;
  expiresAt?: number;
  status: string;
  requestIdExpiresAt?: number;
};

export function createConvexApiKeyCreateArgsValidator<ScopeValidator extends GenericValidator>(
  scopeValidator: ScopeValidator,
) {
  return {
    name: v.string(),
    scopes: v.array(scopeValidator),
    allowedIpRanges: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
    requestId: v.optional(v.string()),
  };
}

export function createConvexApiKeyIdArgsValidator<ApiKeyIdValidator extends GenericValidator>(
  apiKeyIdValidator: ApiKeyIdValidator,
) {
  return {
    apiKeyId: apiKeyIdValidator,
  };
}

export function resolveApiKeyRequestId(
  requestId: string | undefined,
  options: { maxLength: number },
): ApiKeyRequestIdResult {
  const normalized = requestId?.trim();
  if (!normalized) {
    return { ok: true, requestId: undefined };
  }

  if (normalized.length > options.maxLength) {
    return { ok: false, reason: "too_long" };
  }

  return { ok: true, requestId: normalized };
}

export function normalizeConvexApiKeyCreateInput<Scope extends string>(args: {
  name: string;
  scopes: readonly Scope[];
  allowedIpRanges?: readonly string[] | null;
  expiresAt?: number;
  requestId?: string;
  now?: number;
  maxRequestIdLength?: number;
  replayWindowMs?: number;
}): ConvexApiKeyCreateInputResult<Scope> {
  const name = args.name.trim();
  if (name.length === 0) {
    return { ok: false, reason: "empty_name" };
  }

  if (args.scopes.length === 0) {
    return { ok: false, reason: "empty_scopes" };
  }

  const requestIdResult = resolveApiKeyRequestId(args.requestId, {
    maxLength: args.maxRequestIdLength ?? defaultApiKeyRequestIdMaxLength,
  });
  if (!requestIdResult.ok) {
    return { ok: false, reason: "request_id_too_long" };
  }

  const now = args.now ?? Date.now();
  if (args.expiresAt !== undefined && args.expiresAt <= now) {
    return { ok: false, reason: "expires_at_not_future" };
  }

  const requestIdExpiresAt =
    requestIdResult.requestId === undefined
      ? undefined
      : now + (args.replayWindowMs ?? defaultApiKeyCreateReplayWindowMs);

  return {
    ok: true,
    input: {
      name,
      scopes: [...args.scopes],
      allowedIpRanges: normalizeApiKeyAllowedIpRanges(args.allowedIpRanges ?? []),
      expiresAt: args.expiresAt,
      requestId: requestIdResult.requestId,
      requestIdExpiresAt,
    },
  };
}

export function isConvexApiKeyCreateReplayInputMatch(
  existingApiKey: Pick<
    ConvexApiKeyReplayRecord,
    "name" | "expiresAt" | "scopes" | "allowedIpRanges"
  >,
  input: Pick<
    ConvexApiKeyNormalizedCreateInput,
    "name" | "expiresAt" | "scopes" | "allowedIpRanges"
  >,
): boolean {
  return (
    existingApiKey.name === input.name &&
    existingApiKey.expiresAt === input.expiresAt &&
    stringArraysEqual(existingApiKey.scopes, input.scopes) &&
    stringArraysEqual(existingApiKey.allowedIpRanges ?? [], input.allowedIpRanges)
  );
}

export function isConvexApiKeyCreateReplayWindowOpen(
  existingApiKey: Pick<ConvexApiKeyReplayRecord, "status" | "requestIdExpiresAt">,
  now: number,
): boolean {
  return (
    existingApiKey.status === "active" &&
    existingApiKey.requestIdExpiresAt !== undefined &&
    existingApiKey.requestIdExpiresAt > now
  );
}

export function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeApiKeyAllowedIpRanges(allowedIpRanges: readonly string[]): string[] {
  return allowedIpRanges.map((ipRange) => ipRange.trim()).filter(Boolean);
}
