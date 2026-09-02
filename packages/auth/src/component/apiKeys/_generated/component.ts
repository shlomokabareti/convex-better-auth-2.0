/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    apiKeys: {
      getApiKey: FunctionReference<
        "query",
        "internal",
        { apiKeyId: string },
        null | {
          _creationTime: number;
          _id: string;
          allowedIpRanges?: Array<string>;
          createdAt: number;
          environment?: "sandbox" | "production";
          expiresAt?: number;
          fixedOrganizationId?: string;
          keyHash: string;
          keyPrefix: string;
          keyStart?: string;
          lastRefillAt?: number;
          lastRequestAt?: number;
          lastUsedAt?: number;
          lastUsedIp?: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          ownerId?: string;
          ownerServicePrincipalId?: string;
          ownerType?: "user" | "organization" | "service";
          permissions?: Array<string>;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          requestCount?: number;
          requestId?: string;
          requestIdExpiresAt?: number;
          scopes: Array<string>;
          status: "active" | "revoked";
          updatedAt: number;
          userId?: string;
          windowStartedAt?: number;
        },
        Name
      >;
      getApiKeyByPrefix: FunctionReference<
        "query",
        "internal",
        { keyPrefix: string },
        null | {
          _creationTime: number;
          _id: string;
          allowedIpRanges?: Array<string>;
          createdAt: number;
          environment?: "sandbox" | "production";
          expiresAt?: number;
          fixedOrganizationId?: string;
          keyHash: string;
          keyPrefix: string;
          keyStart?: string;
          lastRefillAt?: number;
          lastRequestAt?: number;
          lastUsedAt?: number;
          lastUsedIp?: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          ownerId?: string;
          ownerServicePrincipalId?: string;
          ownerType?: "user" | "organization" | "service";
          permissions?: Array<string>;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          requestCount?: number;
          requestId?: string;
          requestIdExpiresAt?: number;
          scopes: Array<string>;
          status: "active" | "revoked";
          updatedAt: number;
          userId?: string;
          windowStartedAt?: number;
        },
        Name
      >;
      getApiKeyByRequestId: FunctionReference<
        "query",
        "internal",
        { organizationId: string; requestId: string },
        null | {
          _creationTime: number;
          _id: string;
          allowedIpRanges?: Array<string>;
          createdAt: number;
          environment?: "sandbox" | "production";
          expiresAt?: number;
          fixedOrganizationId?: string;
          keyHash: string;
          keyPrefix: string;
          keyStart?: string;
          lastRefillAt?: number;
          lastRequestAt?: number;
          lastUsedAt?: number;
          lastUsedIp?: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          ownerId?: string;
          ownerServicePrincipalId?: string;
          ownerType?: "user" | "organization" | "service";
          permissions?: Array<string>;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          requestCount?: number;
          requestId?: string;
          requestIdExpiresAt?: number;
          scopes: Array<string>;
          status: "active" | "revoked";
          updatedAt: number;
          userId?: string;
          windowStartedAt?: number;
        },
        Name
      >;
      issueApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          environment: "sandbox" | "production";
          expiresAt?: number;
          keyBrand?: string;
          metadataJson?: string;
          name: string;
          now?: number;
          organizationId: string;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          scopes?: Array<string>;
          userId: string;
        },
        {
          apiKey: string;
          apiKeyId: string;
          keyPrefix: string;
          keyStart: string;
        },
        Name
      >;
      issueServiceOwnedApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          environment: "sandbox" | "production";
          expiresAt?: number;
          keyBrand?: string;
          metadataJson?: string;
          name: string;
          now?: number;
          permissions?: Array<string> | null;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          scopes?: Array<string>;
          servicePrincipalId: string;
        },
        {
          apiKey: string;
          apiKeyId: string;
          keyPrefix: string;
          keyStart: string;
        },
        Name
      >;
      listApiKeysByOrganization: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          organizationId: string;
          status?: "active" | "revoked";
        },
        Array<{
          _creationTime: number;
          _id: string;
          allowedIpRanges?: Array<string>;
          createdAt: number;
          environment?: "sandbox" | "production";
          expiresAt?: number;
          fixedOrganizationId?: string;
          keyHash: string;
          keyPrefix: string;
          keyStart?: string;
          lastRefillAt?: number;
          lastRequestAt?: number;
          lastUsedAt?: number;
          lastUsedIp?: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          ownerId?: string;
          ownerServicePrincipalId?: string;
          ownerType?: "user" | "organization" | "service";
          permissions?: Array<string>;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          requestCount?: number;
          requestId?: string;
          requestIdExpiresAt?: number;
          scopes: Array<string>;
          status: "active" | "revoked";
          updatedAt: number;
          userId?: string;
          windowStartedAt?: number;
        }>,
        Name
      >;
      listApiKeysByServicePrincipal: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          servicePrincipalId: string;
          status?: "active" | "revoked";
        },
        Array<{
          _creationTime: number;
          _id: string;
          allowedIpRanges?: Array<string>;
          createdAt: number;
          environment?: "sandbox" | "production";
          expiresAt?: number;
          fixedOrganizationId?: string;
          keyHash: string;
          keyPrefix: string;
          keyStart?: string;
          lastRefillAt?: number;
          lastRequestAt?: number;
          lastUsedAt?: number;
          lastUsedIp?: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          ownerId?: string;
          ownerServicePrincipalId?: string;
          ownerType?: "user" | "organization" | "service";
          permissions?: Array<string>;
          rateLimitEnabled?: boolean;
          rateLimitMax?: number;
          rateLimitTimeWindowMs?: number;
          refillAmount?: number;
          refillIntervalMs?: number;
          remaining?: number;
          requestCount?: number;
          requestId?: string;
          requestIdExpiresAt?: number;
          scopes: Array<string>;
          status: "active" | "revoked";
          updatedAt: number;
          userId?: string;
          windowStartedAt?: number;
        }>,
        Name
      >;
      revokeApiKey: FunctionReference<
        "mutation",
        "internal",
        { apiKeyId: string; organizationId: string },
        { ok: true },
        Name
      >;
      rotateApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          apiKeyId: string;
          keyHash: string;
          keyPrefix: string;
          organizationId: string;
        },
        { ok: true },
        Name
      >;
      touchApiKeyLastUsed: FunctionReference<
        "mutation",
        "internal",
        { apiKeyId: string; ip?: string | null; organizationId: string },
        { ok: true },
        Name
      >;
      upsertApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          allowedIpRanges?: Array<string> | null;
          apiKeyId?: string;
          environment?: "sandbox" | "production";
          expiresAt?: number | null;
          keyHash: string;
          keyPrefix: string;
          metadataJson?: string | null;
          name: string;
          organizationId: string;
          requestId?: string | null;
          requestIdExpiresAt?: number | null;
          scopes: Array<string>;
          status?: "active" | "revoked";
          userId: string;
        },
        { apiKeyId: string; created: boolean },
        Name
      >;
      upsertServiceOwnedApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          allowedIpRanges?: Array<string> | null;
          apiKeyId?: string;
          environment?: "sandbox" | "production";
          expiresAt?: number | null;
          keyHash: string;
          keyPrefix: string;
          metadataJson?: string | null;
          name: string;
          permissions?: Array<string> | null;
          requestId?: string | null;
          requestIdExpiresAt?: number | null;
          scopes: Array<string>;
          servicePrincipalId: string;
          status?: "active" | "revoked";
        },
        { apiKeyId: string; created: boolean },
        Name
      >;
      verifyApiKey: FunctionReference<
        "mutation",
        "internal",
        {
          environment?: "sandbox" | "production";
          now?: number;
          presentedKey: string;
          requiredScopes?: Array<string>;
        },
        | {
            apiKeyId: string;
            environment?: "sandbox" | "production";
            organizationId?: string;
            principal: {
              id?: string;
              rateLimitKey: string;
              type: "human" | "service";
            };
            remaining?: number;
            scopes: Array<string>;
            userId?: string;
            valid: true;
          }
        | {
            reason:
              | "malformed"
              | "not_found"
              | "revoked"
              | "expired"
              | "environment_mismatch"
              | "scope_missing"
              | "rate_limited"
              | "quota_exhausted";
            valid: false;
          },
        Name
      >;
    };
  };
