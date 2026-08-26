import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ResolvedAuthContext } from "../coreTypes";
import { createAuthAuditEvent } from "./createAuthAuditEvent";

describe("createAuthAuditEvent", () => {
  const userContext: ResolvedAuthContext = {
    principal: {
      kind: "user",
      userId: "u1",
      identityId: "id1",
      activeOrganizationId: "o1",
      membershipIds: [],
      roleKeys: [],
      permissions: [],
      sessionId: null,
      isRestricted: false,
      restrictedReason: null,
    },
    execution: {
      organizationId: "o1",
      resourceType: "convex.query",
      resourceId: "q1",
      audience: null,
      scopes: [],
    },
  };

  it("maps user principal id correctly", () => {
    const event = createAuthAuditEvent({
      eventType: "auth.sign_in",
      context: userContext,
      success: true,
    });
    assert.equal(event.principalKind, "user");
    assert.equal(event.principalId, "u1");
    assert.equal(event.organizationId, "o1");
    assert.equal(event.success, true);
  });

  it("uses explicit resource over execution fallback", () => {
    const event = createAuthAuditEvent({
      eventType: "auth.action",
      context: userContext,
      success: false,
      resourceType: "override",
      resourceId: "r2",
    });
    assert.equal(event.resourceType, "override");
    assert.equal(event.resourceId, "r2");
  });

  it("falls back to execution resource when not specified", () => {
    const event = createAuthAuditEvent({
      eventType: "auth.action",
      context: userContext,
      success: true,
    });
    assert.equal(event.resourceType, "convex.query");
    assert.equal(event.resourceId, "q1");
  });
});
