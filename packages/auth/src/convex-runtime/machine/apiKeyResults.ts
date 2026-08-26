import { v } from "convex/values";

import { formatApiKeyToken } from "./apiKeyToken";

export type ConvexApiKeyTokenResult<
  ApiKeyId extends string = string,
  Scope extends string = string,
> = {
  apiKeyId: ApiKeyId;
  token: string;
  keyPrefix: string;
  scopes: Scope[];
  expiresAt?: number;
  allowedIpRanges: string[];
};

export type ConvexApiKeyRotateResult<
  ApiKeyId extends string = string,
  Scope extends string = string,
> = ConvexApiKeyTokenResult<ApiKeyId, Scope>;

export type ConvexApiKeyMutationOkResult = {
  ok: true;
};

export type ConvexApiKeyListItem<
  ApiKeyId extends string = string,
  Scope extends string = string,
  CreatorId extends string = string,
> = {
  _id: ApiKeyId;
  name: string;
  keyPrefix: string;
  scopes: Scope[];
  status: "active" | "revoked";
  expiresAt?: number;
  allowedIpRanges: string[];
  lastUsedAt?: number;
  lastUsedIp?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: {
    _id: CreatorId;
    name?: string;
    email: string;
  } | null;
};

export const convexApiKeyTokenResultValidator = v.object({
  apiKeyId: v.string(),
  token: v.string(),
  keyPrefix: v.string(),
  scopes: v.array(v.string()),
  expiresAt: v.optional(v.number()),
  allowedIpRanges: v.array(v.string()),
});

export const convexApiKeyMutationOkResultValidator = v.object({
  ok: v.literal(true),
});

export const convexApiKeyListItemValidator = v.object({
  _id: v.string(),
  name: v.string(),
  keyPrefix: v.string(),
  scopes: v.array(v.string()),
  status: v.union(v.literal("active"), v.literal("revoked")),
  expiresAt: v.optional(v.number()),
  allowedIpRanges: v.array(v.string()),
  lastUsedAt: v.optional(v.number()),
  lastUsedIp: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.union(
    v.object({
      _id: v.string(),
      name: v.optional(v.string()),
      email: v.string(),
    }),
    v.null()
  ),
});

export const convexApiKeyListResultValidator = v.array(
  convexApiKeyListItemValidator
);

export function createConvexApiKeyTokenResult<
  ApiKeyId extends string,
  Scope extends string,
>(args: {
  apiKeyId: ApiKeyId;
  keyPrefix: string;
  secret: string;
  scopes: readonly Scope[];
  expiresAt?: number;
  allowedIpRanges?: readonly string[] | null;
}): ConvexApiKeyTokenResult<ApiKeyId, Scope> {
  return {
    apiKeyId: args.apiKeyId,
    token: formatApiKeyToken({
      keyPrefix: args.keyPrefix,
      secret: args.secret,
    }),
    keyPrefix: args.keyPrefix,
    scopes: [...args.scopes],
    expiresAt: args.expiresAt,
    allowedIpRanges: [...(args.allowedIpRanges ?? [])],
  };
}

export function createConvexApiKeyListItem<
  ApiKeyId extends string,
  Scope extends string,
  CreatorId extends string,
>(args: {
  apiKey: {
    _id: ApiKeyId;
    name: string;
    keyPrefix: string;
    scopes: readonly Scope[];
    status: "active" | "revoked";
    expiresAt?: number;
    allowedIpRanges?: readonly string[] | null;
    lastUsedAt?: number;
    lastUsedIp?: string;
    createdAt: number;
    updatedAt: number;
  };
  createdBy?: {
    _id: CreatorId;
    name?: string;
    email: string;
  } | null;
}): ConvexApiKeyListItem<ApiKeyId, Scope, CreatorId> {
  return {
    _id: args.apiKey._id,
    name: args.apiKey.name,
    keyPrefix: args.apiKey.keyPrefix,
    scopes: [...args.apiKey.scopes],
    status: args.apiKey.status,
    expiresAt: args.apiKey.expiresAt,
    allowedIpRanges: [...(args.apiKey.allowedIpRanges ?? [])],
    lastUsedAt: args.apiKey.lastUsedAt,
    lastUsedIp: args.apiKey.lastUsedIp,
    createdAt: args.apiKey.createdAt,
    updatedAt: args.apiKey.updatedAt,
    createdBy: args.createdBy ?? null,
  };
}
