import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { buildApiAuthUserIdentityResult } from "./buildApiAuthUserIdentityResult";

describe("buildApiAuthUserIdentityResult", () => {
  it("returns only active memberships and roles", () => {
    assert.deepEqual(
      buildApiAuthUserIdentityResult({
        userId: "user_1",
        linkedIdentityId: "identity_1",
        activeOrganizationId: "org_2",
        memberships: [
          {
            _id: "membership_1",
            organizationId: "org_1",
            roleTemplate: "owner",
            status: "active",
          },
          {
            _id: "membership_2",
            organizationId: "org_2",
            roleTemplate: "member",
            status: "pending",
          },
        ],
      }),
      {
        userId: "user_1",
        identityId: "identity_1",
        activeOrganizationId: "org_2",
        membershipIds: ["membership_1"],
        roleKeys: ["owner"],
        permissions: [],
        isRestricted: false,
        restrictedReason: null,
      }
    );
  });

  it("supports restricted callers", () => {
    assert.deepEqual(
      buildApiAuthUserIdentityResult({
        userId: "user_1",
        memberships: [],
        isRestricted: true,
        restrictedReason: "suspended",
      }),
      {
        userId: "user_1",
        identityId: null,
        activeOrganizationId: null,
        membershipIds: [],
        roleKeys: [],
        permissions: [],
        isRestricted: true,
        restrictedReason: "suspended",
      }
    );
  });
});
