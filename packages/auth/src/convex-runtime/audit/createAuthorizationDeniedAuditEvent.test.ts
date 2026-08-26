import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ResolvedAuthContext } from "../coreTypes";
import { createAuthorizationDeniedAuditEvent } from "./createAuthorizationDeniedAuditEvent";
import { createPermissionDeniedAuditEvent } from "./createPermissionDeniedAuditEvent";
import { createRestrictionDeniedAuditEvent } from "./createRestrictionDeniedAuditEvent";

const context: ResolvedAuthContext = {
  principal: {
    kind: "user",
    userId: "u1",
    identityId: "id1",
    activeOrganizationId: "o1",
    membershipIds: [],
    roleKeys: [],
    permissions: ["org:read"],
    sessionId: null,
    isRestricted: true,
    restrictedReason: "manual_hold",
  },
  execution: {
    organizationId: "o1",
    resourceType: "convex.query",
    resourceId: "q1",
    audience: null,
    scopes: [],
  },
};

describe("authorization denied audit helpers", () => {
  it("creates generic authorization denied event", () => {
    const event = createAuthorizationDeniedAuditEvent({
      context,
      denialReason: "authentication",
      reasonDetail: "missing bearer token",
      metadata: {
        source: "middleware",
      },
    });

    assert.equal(event.eventType, "auth.authorization_denied");
    assert.equal(event.success, false);
    assert.deepStrictEqual(event.metadata, {
      denialReason: "authentication",
      reasonDetail: "missing bearer token",
      source: "middleware",
    });
  });

  it("creates permission denied event with permission metadata", () => {
    const event = createPermissionDeniedAuditEvent({
      context,
      permission: "org:write",
      reasonDetail: "Permission required: org:write",
    });

    assert.equal(event.eventType, "auth.authorization_denied");
    assert.deepStrictEqual(event.metadata, {
      denialReason: "permission",
      denialCode: "PERMISSION_REQUIRED",
      reasonDetail: "Permission required: org:write",
      permission: "org:write",
    });
  });

  it("creates restriction denied event", () => {
    const event = createRestrictionDeniedAuditEvent({
      context,
      reasonDetail: "manual_hold",
    });

    assert.equal(event.eventType, "auth.authorization_denied");
    assert.deepStrictEqual(event.metadata, {
      denialReason: "restriction",
      denialCode: "PRINCIPAL_RESTRICTED",
      reasonDetail: "manual_hold",
    });
  });
});
