import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  resolveConvexUserContext,
  resolveConvexUserPrincipal,
  type ConvexUserIdentity,
} from "./resolveConvexUserContext";

describe("resolveConvexUserPrincipal", () => {
  it("uses canonical identity fields by default", () => {
    const identity: ConvexUserIdentity = {
      subject: "user_123",
      issuer: "https://auth.example.com",
      tokenIdentifier: "https://auth.example.com|user_123",
      sessionId: "session_123",
    };

    const principal = resolveConvexUserPrincipal({ identity });

    assert.deepStrictEqual(principal, {
      kind: "user",
      userId: "user_123",
      identityId: "https://auth.example.com|user_123",
      activeOrganizationId: null,
      membershipIds: [],
      roleKeys: [],
      permissions: [],
      sessionId: "session_123",
      isRestricted: false,
      restrictedReason: null,
    });
  });

  it("falls back to sid when sessionId is absent", () => {
    const identity: ConvexUserIdentity = {
      subject: "user_123",
      issuer: "https://auth.example.com",
      tokenIdentifier: "https://auth.example.com|user_123",
      sid: "session_from_sid",
    };

    const principal = resolveConvexUserPrincipal({ identity });

    assert.equal(principal.sessionId, "session_from_sid");
  });

  it("prefers explicit principal record fields over identity defaults", () => {
    const identity: ConvexUserIdentity = {
      subject: "user_123",
      issuer: "https://auth.example.com",
      tokenIdentifier: "https://auth.example.com|user_123",
      sessionId: "session_123",
    };

    const principal = resolveConvexUserPrincipal({
      identity,
      principal: {
        userId: "user_override",
        identityId: "identity_override",
        activeOrganizationId: "org_123",
        membershipIds: ["membership_1"],
        roleKeys: ["org:owner"],
        permissions: ["org:read", "org:write"],
        sessionId: "session_override",
        isRestricted: true,
        restrictedReason: "manual_hold",
      },
    });

    assert.deepStrictEqual(principal, {
      kind: "user",
      userId: "user_override",
      identityId: "identity_override",
      activeOrganizationId: "org_123",
      membershipIds: ["membership_1"],
      roleKeys: ["org:owner"],
      permissions: ["org:read", "org:write"],
      sessionId: "session_override",
      isRestricted: true,
      restrictedReason: "manual_hold",
    });
  });
});

describe("resolveConvexUserContext", () => {
  it("returns user principal context with execution defaults", () => {
    const identity: ConvexUserIdentity = {
      subject: "user_123",
      issuer: "https://auth.example.com",
      tokenIdentifier: "https://auth.example.com|user_123",
      sessionId: "session_123",
    };

    const context = resolveConvexUserContext({
      identity,
      principal: {
        activeOrganizationId: "org_123",
        permissions: ["org:read"],
      },
      input: {
        resourceType: "convex.query",
        resourceId: "protected:getViewerContext",
      },
    });

    assert.equal(context.principal.kind, "user");
    assert.equal(context.principal.identityId, "https://auth.example.com|user_123");
    assert.equal(context.principal.sessionId, "session_123");
    assert.deepStrictEqual(context.execution, {
      organizationId: "org_123",
      resourceType: "convex.query",
      resourceId: "protected:getViewerContext",
      audience: null,
      scopes: [],
    });
  });
});
