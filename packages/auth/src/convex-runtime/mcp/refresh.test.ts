import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createMcpOAuthRefreshToken,
  createMcpOAuthRefreshTokenPolicy,
  getMcpOAuthRefreshTokenStatus,
  hashMcpOAuthRefreshToken,
  redeemMcpOAuthRefreshToken,
  resolveMcpOAuthRefreshTokenGrantedScopes,
  rotateMcpOAuthRefreshToken,
  validateMcpOAuthRefreshTokenGrantRequest,
} from "./refresh";

describe("mcp oauth refresh helpers", () => {
  it("hashes refresh tokens deterministically", async () => {
    const first = await hashMcpOAuthRefreshToken("refresh_123");
    const second = await hashMcpOAuthRefreshToken("refresh_123");
    const third = await hashMcpOAuthRefreshToken("refresh_456");

    assert.equal(first.tokenHash, second.tokenHash);
    assert.notEqual(first.tokenHash, third.tokenHash);
    assert.equal(first.tokenHash.length, 64);
  });

  it("creates refresh token policy", () => {
    assert.deepEqual(
      createMcpOAuthRefreshTokenPolicy({
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      }),
      {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
    );
  });

  it("creates refresh token record", () => {
    const issued = createMcpOAuthRefreshToken({
      clientId: "client_123",
      subjectId: "user_123",
      organizationId: "org_123",
      scopes: ["crm:organization:read", "crm:tasks:read", "crm:tasks:read"],
      audience: "crm-mcp",
      resourceId: "crm:mcp",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_000_000,
      refreshToken: "refresh_123",
      tokenId: "rt_123",
    });

    assert.deepEqual(issued, {
      refreshToken: "refresh_123",
      record: {
        tokenId: "rt_123",
        familyId: "rt_123",
        parentTokenId: null,
        clientId: "client_123",
        subjectId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read", "crm:tasks:read"],
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        issuedAt: 1_700_000_000_000,
        expiresAt: 1_700_086_400_000,
        inactivityExpiresAt: 1_700_003_600_000,
        consumedAt: null,
        revokedAt: null,
        replacedByTokenId: null,
      },
    });
  });

  it("rotates refresh token within same family", () => {
    const current = createMcpOAuthRefreshToken({
      clientId: "client_123",
      subjectId: "user_123",
      organizationId: "org_123",
      scopes: ["crm:organization:read", "crm:tasks:read"],
      audience: "crm-mcp",
      resourceId: "crm:mcp",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_000_000,
      refreshToken: "refresh_123",
      tokenId: "rt_123",
    });

    const rotated = rotateMcpOAuthRefreshToken({
      record: current.record,
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_100_000,
      refreshToken: "refresh_456",
      tokenId: "rt_456",
    });

    assert.deepEqual(rotated, {
      refreshToken: "refresh_456",
      record: {
        tokenId: "rt_456",
        familyId: "rt_123",
        parentTokenId: "rt_123",
        clientId: "client_123",
        subjectId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read", "crm:tasks:read"],
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        issuedAt: 1_700_000_100_000,
        expiresAt: 1_700_086_500_000,
        inactivityExpiresAt: 1_700_003_700_000,
        consumedAt: null,
        revokedAt: null,
        replacedByTokenId: null,
      },
      consumedRecordPatch: {
        consumedAt: 1_700_000_100_000,
        replacedByTokenId: "rt_456",
      },
    });
  });

  it("validates refresh token grant request", async () => {
    const result = await validateMcpOAuthRefreshTokenGrantRequest({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "refresh_123",
          client_id: "client_123",
          scope: "crm:organization:read",
        }),
      }),
      resolveClient: () => ({
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      }),
    });

    assert.deepEqual(result, {
      ok: true,
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshToken: "refresh_123",
      requestedScopes: ["crm:organization:read"],
    });
  });

  it("rejects refresh token request with unsupported scope", async () => {
    const result = await validateMcpOAuthRefreshTokenGrantRequest({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "refresh_123",
          client_id: "client_123",
          scope: "crm:opportunities:write",
        }),
      }),
      resolveClient: () => ({
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      }),
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_scope",
        error_description: "Unsupported scope: crm:opportunities:write",
      },
    });
  });

  it("resolves granted scopes from stored refresh token", () => {
    const result = resolveMcpOAuthRefreshTokenGrantedScopes({
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshTokenRecord: {
        scopes: ["crm:organization:read", "crm:tasks:read"],
      },
      requestedScopes: ["crm:organization:read"],
    });

    assert.deepEqual(result, {
      ok: true,
      scopes: ["crm:organization:read"],
    });
  });

  it("rejects scope escalation from stored refresh token", () => {
    const result = resolveMcpOAuthRefreshTokenGrantedScopes({
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshTokenRecord: {
        scopes: ["crm:organization:read"],
      },
      requestedScopes: ["crm:tasks:read"],
    });

    assert.deepEqual(result, {
      ok: false,
      error: "invalid_scope",
      error_description: "Requested scope exceeds originally granted scope: crm:tasks:read",
    });
  });

  it("redeems refresh token with atomic rotation contract", async () => {
    const current = createMcpOAuthRefreshToken({
      clientId: "client_123",
      subjectId: "user_123",
      organizationId: "org_123",
      scopes: ["crm:organization:read", "crm:tasks:read"],
      audience: "crm-mcp",
      resourceId: "crm:mcp",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_000_000,
      refreshToken: "refresh_123",
      tokenId: "rt_123",
    });

    let rotateCallCount = 0;
    const result = await redeemMcpOAuthRefreshToken({
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshToken: "refresh_123",
      requestedScopes: ["crm:organization:read"],
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_100_000,
      nextRefreshToken: "refresh_456",
      nextTokenId: "rt_456",
      storage: {
        findForRefreshToken: ({ refreshToken, clientId }) => {
          assert.equal(refreshToken, "refresh_123");
          assert.equal(clientId, "client_123");
          return current.record;
        },
        rotate: (input) => {
          rotateCallCount += 1;
          assert.equal(input.currentRecord.tokenId, "rt_123");
          assert.equal(input.currentRefreshToken, "refresh_123");
          assert.equal(input.nextRecord.tokenId, "rt_456");
          assert.equal(input.nextRefreshToken, "refresh_456");
          assert.deepEqual(input.consumedRecordPatch, {
            consumedAt: 1_700_000_100_000,
            replacedByTokenId: "rt_456",
          });
          return { ok: true };
        },
      },
    });

    assert.equal(rotateCallCount, 1);
    assert.deepEqual(result, {
      ok: true,
      record: current.record,
      scopes: ["crm:organization:read"],
      rotation: {
        refreshToken: "refresh_456",
        record: {
          tokenId: "rt_456",
          familyId: "rt_123",
          parentTokenId: "rt_123",
          clientId: "client_123",
          subjectId: "user_123",
          organizationId: "org_123",
          scopes: ["crm:organization:read"],
          audience: "crm-mcp",
          resourceId: "crm:mcp",
          issuedAt: 1_700_000_100_000,
          expiresAt: 1_700_086_500_000,
          inactivityExpiresAt: 1_700_003_700_000,
          consumedAt: null,
          revokedAt: null,
          replacedByTokenId: null,
        },
        consumedRecordPatch: {
          consumedAt: 1_700_000_100_000,
          replacedByTokenId: "rt_456",
        },
      },
    });
  });

  it("revokes family on replay detection", async () => {
    const revokedFamilies: Array<{
      familyId: string;
      revokedAt: number;
      reason: string;
    }> = [];

    const result = await redeemMcpOAuthRefreshToken({
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshToken: "refresh_123",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_100_000,
      storage: {
        findForRefreshToken: () => ({
          tokenId: "rt_123",
          familyId: "family_123",
          parentTokenId: null,
          clientId: "client_123",
          subjectId: "user_123",
          organizationId: "org_123",
          scopes: ["crm:organization:read"],
          audience: "crm-mcp",
          resourceId: "crm:mcp",
          issuedAt: 1_700_000_000_000,
          expiresAt: 1_700_086_400_000,
          inactivityExpiresAt: 1_700_003_600_000,
          consumedAt: 1_700_000_050_000,
          revokedAt: null,
          replacedByTokenId: "rt_456",
        }),
        rotate: () => ({ ok: true }),
        revokeFamily: (input) => {
          revokedFamilies.push(input);
        },
      },
    });

    assert.deepEqual(revokedFamilies, [
      {
        familyId: "family_123",
        revokedAt: 1_700_000_100_000,
        reason: "replay_detected",
      },
    ]);
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Refresh token reuse detected",
      },
      reason: "replay_detected",
      familyRevocation: {
        familyId: "family_123",
        revokedAt: 1_700_000_100_000,
        reason: "replay_detected",
      },
    });
  });

  it("revokes family on concurrent rotation conflict", async () => {
    const current = createMcpOAuthRefreshToken({
      clientId: "client_123",
      subjectId: "user_123",
      organizationId: "org_123",
      scopes: ["crm:organization:read"],
      audience: "crm-mcp",
      resourceId: "crm:mcp",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_000_000,
      refreshToken: "refresh_123",
      tokenId: "rt_123",
    });
    const revokedFamilies: Array<{
      familyId: string;
      revokedAt: number;
      reason: string;
    }> = [];

    const result = await redeemMcpOAuthRefreshToken({
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      },
      refreshToken: "refresh_123",
      policy: {
        absoluteLifetimeMs: 86_400_000,
        inactivityLifetimeMs: 3_600_000,
      },
      now: 1_700_000_100_000,
      storage: {
        findForRefreshToken: () => current.record,
        rotate: () => ({ ok: false, reason: "conflict" }),
        revokeFamily: (input) => {
          revokedFamilies.push(input);
        },
      },
    });

    assert.deepEqual(revokedFamilies, [
      {
        familyId: "rt_123",
        revokedAt: 1_700_000_100_000,
        reason: "concurrent_conflict",
      },
    ]);
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Refresh token already used",
      },
      reason: "concurrent_conflict",
      familyRevocation: {
        familyId: "rt_123",
        revokedAt: 1_700_000_100_000,
        reason: "concurrent_conflict",
      },
    });
  });

  it("classifies refresh token status", () => {
    assert.equal(
      getMcpOAuthRefreshTokenStatus(
        {
          expiresAt: 1_700_000_100_000,
          inactivityExpiresAt: 1_700_000_050_000,
          consumedAt: null,
          revokedAt: null,
        },
        1_700_000_000_000,
      ),
      "active",
    );
    assert.equal(
      getMcpOAuthRefreshTokenStatus(
        {
          expiresAt: 1_700_000_000_000,
          inactivityExpiresAt: 1_700_000_050_000,
          consumedAt: null,
          revokedAt: null,
        },
        1_700_000_000_000,
      ),
      "expired",
    );
    assert.equal(
      getMcpOAuthRefreshTokenStatus(
        {
          expiresAt: 1_700_000_100_000,
          inactivityExpiresAt: 1_700_000_000_000,
          consumedAt: null,
          revokedAt: null,
        },
        1_700_000_000_000,
      ),
      "inactive",
    );
    assert.equal(
      getMcpOAuthRefreshTokenStatus(
        {
          expiresAt: 1_700_000_100_000,
          inactivityExpiresAt: 1_700_000_050_000,
          consumedAt: 1_700_000_000_000,
          revokedAt: null,
        },
        1_700_000_000_000,
      ),
      "consumed",
    );
    assert.equal(
      getMcpOAuthRefreshTokenStatus(
        {
          expiresAt: 1_700_000_100_000,
          inactivityExpiresAt: 1_700_000_050_000,
          consumedAt: null,
          revokedAt: 1_700_000_000_000,
        },
        1_700_000_000_000,
      ),
      "revoked",
    );
  });
});
