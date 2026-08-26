import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ResolvedAuthContext } from "../coreTypes";
import {
  authorizeAuthenticated,
  authorizeNotRestricted,
  authorizeOrganization,
  authorizePermission,
  principalRestrictionReason,
} from "./authorize";

const restrictedUserContext: ResolvedAuthContext = {
  principal: {
    kind: "user",
    userId: "u1",
    identityId: "id1",
    activeOrganizationId: "org_1",
    membershipIds: [],
    roleKeys: [],
    permissions: ["org:read"],
    sessionId: null,
    isRestricted: true,
    restrictedReason: "manual_hold",
  },
  execution: {
    organizationId: "org_1",
    resourceType: null,
    resourceId: null,
    audience: null,
    scopes: [],
  },
};

describe("authorize helpers", () => {
  it("denies anonymous authentication", () => {
    assert.deepStrictEqual(
      authorizeAuthenticated({
        principal: {
          kind: "anonymous",
          permissions: [],
        },
        execution: {
          organizationId: null,
          resourceType: null,
          resourceId: null,
          audience: null,
          scopes: [],
        },
      }),
      {
        allowed: false,
        reason: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      },
    );
  });

  it("denies restricted principal before permission checks", () => {
    assert.deepStrictEqual(authorizeNotRestricted(restrictedUserContext), {
      allowed: false,
      reason: "manual_hold",
      code: "PRINCIPAL_RESTRICTED",
    });

    assert.deepStrictEqual(authorizePermission(restrictedUserContext, "org:read"), {
      allowed: false,
      reason: "manual_hold",
      code: "PRINCIPAL_RESTRICTED",
    });
  });

  it("denies missing organization context", () => {
    assert.deepStrictEqual(
      authorizeOrganization({
        ...restrictedUserContext,
        principal: {
          kind: "user",
          userId: "u1",
          identityId: "id1",
          activeOrganizationId: "org_1",
          membershipIds: [],
          roleKeys: [],
          permissions: ["org:read"],
          sessionId: null,
          isRestricted: false,
          restrictedReason: null,
        },
        execution: {
          ...restrictedUserContext.execution,
          organizationId: null,
        },
      }),
      {
        allowed: false,
        reason: "Organization context required",
        code: "ORGANIZATION_REQUIRED",
      },
    );
  });

  it("returns default restriction message when reason missing", () => {
    assert.equal(
      principalRestrictionReason({
        kind: "service",
        serviceId: "svc_1",
        keyId: null,
        organizationId: null,
        permissions: [],
        isRestricted: true,
        restrictedReason: null,
      }),
      "Principal is restricted",
    );
  });
});
