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
    agentAuth: {
      cleanupExpiredAgentHostReplayRecords: FunctionReference<
        "mutation",
        "internal",
        { limit?: number },
        { deleted: number },
        Name
      >;
      cleanupExpiredAgentReplayRecords: FunctionReference<
        "mutation",
        "internal",
        { limit?: number },
        { deleted: number },
        Name
      >;
      consumeAgentCredential: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          claimedCapabilities?: Array<string>;
          claimedPermissions?: Array<string>;
          hostKeyGeneration?: number;
          keyGeneration: number;
          replayExpiresAt: number;
          replayIdHash: string;
          requestedOrganizationId?: string;
        },
        {
          agentId: string;
          capabilityGrants: Array<{
            capability: string;
            constraintsJson?: string;
            expiresAt?: number;
          }>;
          credentialId: string;
          delegatedUserId: string | null;
          hostId: string;
          isRestricted: boolean;
          kind: "agent";
          mode: "delegated" | "autonomous";
          organizationId: string;
          permissions: Array<string>;
          restrictedReason: string | null;
        },
        Name
      >;
      consumeAgentHostRequest: FunctionReference<
        "mutation",
        "internal",
        {
          hostId: string;
          keyGeneration: number;
          replayExpiresAt: number;
          replayIdHash: string;
          requestedOrganizationId?: string;
        },
        { hostId: string; keyGeneration: number; organizationId: string },
        Name
      >;
      decideAgentDeviceAuthorization: FunctionReference<
        "mutation",
        "internal",
        {
          decision: "approved" | "denied";
          operatorUserId: string;
          organizationId: string;
          userCodeHash: string;
        },
        | { ok: true; status: "approved" | "denied" }
        | {
            ok: false;
            reason: "invalid_code" | "rate_limited";
            retryAt?: number;
          },
        Name
      >;
      getAgentAuthorityStatus: FunctionReference<
        "query",
        "internal",
        { agentId: string; organizationId: string },
        null | {
          absoluteExpiresAt?: number;
          activeKeyGeneration: number;
          agentId: string;
          expiresAt?: number;
          hostId: string;
          mode: "delegated" | "autonomous";
          organizationId: string;
          status: "pending" | "active" | "expired" | "revoked" | "rejected";
        },
        Name
      >;
      getAgentHostAuthorityStatus: FunctionReference<
        "query",
        "internal",
        { hostId: string; organizationId: string },
        null | {
          activeKeyGeneration: number;
          cascadeCompletedAt?: number;
          hostId: string;
          organizationId: string;
          status: "pending" | "active" | "revoked" | "rejected";
        },
        Name
      >;
      getAgentHostProtocolVerificationMaterial: FunctionReference<
        "query",
        "internal",
        { thumbprint: string },
        null | {
          generation: number;
          hostId: string;
          organizationId: string;
          publicJwkJson: string;
          thumbprint: string;
        },
        Name
      >;
      getAgentProtocolVerificationMaterial: FunctionReference<
        "query",
        "internal",
        { agentId: string; hostThumbprint: string },
        null | {
          agentId: string;
          agentKeyGeneration: number;
          agentPublicJwkJson: string;
          hostId: string;
          hostKeyGeneration: number;
          hostThumbprint: string;
          organizationId: string;
        },
        Name
      >;
      getAgentVerificationMaterial: FunctionReference<
        "query",
        "internal",
        { thumbprint: string },
        null | {
          agentId: string;
          generation: number;
          hostId: string;
          organizationId: string;
          publicJwkJson: string;
          thumbprint: string;
        },
        Name
      >;
      introspectAgentAuthority: FunctionReference<
        "query",
        "internal",
        {
          agentId: string;
          claimedCapabilities?: Array<string>;
          claimedPermissions?: Array<string>;
          organizationId: string;
        },
        | { active: false }
        | {
            absoluteExpiresAt?: number;
            active: true;
            agentId: string;
            capabilityGrants: Array<{
              capability: string;
              constraintsJson?: string;
              expiresAt?: number;
            }>;
            delegatedUserId: string | null;
            expiresAt?: number;
            hostId: string;
            mode: "delegated" | "autonomous";
            organizationId: string;
            permissions: Array<string>;
          },
        Name
      >;
      pollAgentDeviceAuthorization: FunctionReference<
        "mutation",
        "internal",
        { deviceCodeHash: string },
        | { interval: number; status: "authorization_pending" }
        | { interval: number; status: "slow_down" }
        | { status: "expired_token" }
        | { status: "access_denied" }
        | { agentId: string; status: "approved" },
        Name
      >;
      reactivateAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          expiresAt: number;
          operatorUserId: string;
          organizationId: string;
        },
        { status: "active" | "revoked" },
        Name
      >;
      reactivateAgentAsHost: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          expiresAt: number;
          hostId: string;
          organizationId: string;
        },
        { status: "active" | "revoked" },
        Name
      >;
      registerAgent: FunctionReference<
        "mutation",
        "internal",
        {
          delegatedUserId?: string;
          hostId: string;
          mode: "delegated" | "autonomous";
          name: string;
          organizationId: string;
          permissions: Array<string>;
          publicJwkJson: string;
          requestedGrants: Array<{
            capability: string;
            constraintsJson?: string;
            expiresAt?: number;
          }>;
        },
        { id: string },
        Name
      >;
      registerAgentHost: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy: string;
          name: string;
          organizationId: string;
          publicJwkJson: string;
        },
        { id: string },
        Name
      >;
      registerAgentWithDeviceAuthorization: FunctionReference<
        "mutation",
        "internal",
        {
          delegatedUserId?: string;
          deviceAuthorization: {
            deviceCodeHash: string;
            expiresAt: number;
            pollIntervalSeconds: number;
            userCodeHash: string;
          };
          hostId: string;
          mode: "delegated" | "autonomous";
          name: string;
          organizationId: string;
          permissions: Array<string>;
          publicJwkJson: string;
          requestedGrants: Array<{
            capability: string;
            constraintsJson?: string;
            expiresAt?: number;
          }>;
        },
        { agentId: string; authorizationId: string },
        Name
      >;
      revokeAgentAsHost: FunctionReference<
        "mutation",
        "internal",
        { agentId: string; hostId: string; organizationId: string },
        { ok: true },
        Name
      >;
      revokeAgentHostAsHost: FunctionReference<
        "mutation",
        "internal",
        { hostId: string; organizationId: string },
        { ok: true },
        Name
      >;
      rotateAgentHostKey: FunctionReference<
        "mutation",
        "internal",
        {
          expectedGeneration: number;
          hostId: string;
          operatorUserId: string;
          organizationId: string;
          publicJwkJson: string;
        },
        { generation: number; thumbprint: string },
        Name
      >;
      rotateAgentHostKeyAsHost: FunctionReference<
        "mutation",
        "internal",
        {
          expectedGeneration: number;
          hostId: string;
          organizationId: string;
          publicJwkJson: string;
        },
        { generation: number; thumbprint: string },
        Name
      >;
      rotateAgentKey: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          expectedGeneration: number;
          operatorUserId: string;
          organizationId: string;
          publicJwkJson: string;
        },
        { generation: number; thumbprint: string },
        Name
      >;
      rotateAgentKeyAsAgent: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          expectedGeneration: number;
          organizationId: string;
          publicJwkJson: string;
        },
        { generation: number; thumbprint: string },
        Name
      >;
      rotateAgentKeyAsHost: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          expectedGeneration: number;
          hostId: string;
          organizationId: string;
          publicJwkJson: string;
        },
        { generation: number; thumbprint: string },
        Name
      >;
      setAgentCapabilityGrantStatus: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          capability: string;
          operatorUserId: string;
          organizationId: string;
          reason?: string;
          status: "pending" | "active" | "denied" | "revoked";
        },
        { ok: true },
        Name
      >;
      setAgentHostStatus: FunctionReference<
        "mutation",
        "internal",
        {
          hostId: string;
          operatorUserId: string;
          organizationId: string;
          status: "pending" | "active" | "revoked" | "rejected";
        },
        { ok: true },
        Name
      >;
      setAgentStatus: FunctionReference<
        "mutation",
        "internal",
        {
          absoluteExpiresAt?: number;
          agentId: string;
          expiresAt?: number;
          operatorUserId: string;
          organizationId: string;
          status: "pending" | "active" | "expired" | "revoked" | "rejected";
        },
        { ok: true },
        Name
      >;
    };
  };
