import { strict as assert } from "node:assert";

import { describe, it } from "vitest";

import { ApiAuthError } from "./errors";
import { resolveLinkedBetterAuthMcpSession } from "./resolveLinkedBetterAuthMcpSession";

describe("resolveLinkedBetterAuthMcpSession", () => {
  it("resolves linked Better Auth MCP user identity and organization access", async () => {
    const context = await resolveLinkedBetterAuthMcpSession({
      session: {
        accessToken: "token",
        clientId: "crm-mcp-client",
        scopes: ["organization:read", "opportunities:read"],
        userId: "better-auth-user-123",
      },
      provider: "better-auth",
      issuer: "https://auth.example.com",
      buildTokenIdentifier: (subject, issuer) => `${issuer}|${subject}`,
      adapter: {
        async getUserByIdentity() {
          return {
            userId: "user_123",
            identityId: "identity_123",
            activeOrganizationId: "org_123",
            membershipIds: ["membership_123"],
            roleKeys: ["member"],
            permissions: [],
            isRestricted: false,
            restrictedReason: null,
          };
        },
        async getOrganizationAccess() {
          return {
            organizationId: "org_456",
            membershipIds: ["membership_456"],
            roleKeys: ["member"],
            permissions: ["organization:view"],
          };
        },
      },
      requestedOrganizationId: "org_456",
      audience: "crm-mcp",
      resourceType: "mcp.tool",
      resourceId: "crm:mcp",
    });

    assert.equal(context.betterAuthUserId, "better-auth-user-123");
    assert.equal(context.userId, "user_123");
    assert.equal(context.organizationId, "org_456");
    assert.deepEqual(context.permissions, ["organization:view"]);
    assert.deepEqual(context.scopes, [
      "organization:read",
      "opportunities:read",
    ]);
  });

  it("rejects client-only MCP sessions", async () => {
    await assert.rejects(
      () =>
        resolveLinkedBetterAuthMcpSession({
          session: {
            accessToken: "token",
            clientId: "crm-mcp-client",
            scopes: ["organization:read"],
          },
          provider: "better-auth",
          issuer: "https://auth.example.com",
          buildTokenIdentifier: (subject, issuer) => `${issuer}|${subject}`,
          adapter: {
            async getUserByIdentity() {
              return null;
            },
            async getOrganizationAccess() {
              return {
                organizationId: null,
                membershipIds: [],
                roleKeys: [],
                permissions: [],
              };
            },
          },
        }),
      (error) =>
        error instanceof ApiAuthError && error.code === "OAUTH_SESSION_INVALID"
    );
  });

  it("rejects restricted linked users (account suspension fails closed)", async () => {
    await assert.rejects(
      () =>
        resolveLinkedBetterAuthMcpSession({
          session: {
            accessToken: "token",
            clientId: "crm-mcp-client",
            scopes: ["organization:read"],
            userId: "better-auth-user-123",
          },
          provider: "better-auth",
          issuer: "https://auth.example.com",
          buildTokenIdentifier: (subject, issuer) => `${issuer}|${subject}`,
          adapter: {
            async getUserByIdentity() {
              return {
                userId: "user_123",
                identityId: "identity_123",
                activeOrganizationId: "org_123",
                membershipIds: ["membership_123"],
                roleKeys: ["member"],
                permissions: [],
                isRestricted: true,
                restrictedReason: "account_suspended",
              };
            },
            async getOrganizationAccess() {
              return {
                organizationId: "org_123",
                membershipIds: ["membership_123"],
                roleKeys: ["member"],
                permissions: ["organization:view"],
              };
            },
          },
        }),
      (error) =>
        error instanceof ApiAuthError && error.code === "PRINCIPAL_RESTRICTED"
    );
  });

  it("rejects unlinked Better Auth users", async () => {
    await assert.rejects(
      () =>
        resolveLinkedBetterAuthMcpSession({
          session: {
            accessToken: "token",
            clientId: "crm-mcp-client",
            scopes: ["organization:read"],
            userId: "better-auth-user-123",
          },
          provider: "better-auth",
          issuer: "https://auth.example.com",
          buildTokenIdentifier: (subject, issuer) => `${issuer}|${subject}`,
          adapter: {
            async getUserByIdentity() {
              return null;
            },
            async getOrganizationAccess() {
              return {
                organizationId: null,
                membershipIds: [],
                roleKeys: [],
                permissions: [],
              };
            },
          },
        }),
      (error) =>
        error instanceof ApiAuthError &&
        error.code === "USER_IDENTITY_NOT_LINKED"
    );
  });
});
