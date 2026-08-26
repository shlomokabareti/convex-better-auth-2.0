import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { wouldRemoveLastActiveOwner } from "./membershipPolicy";

describe("wouldRemoveLastActiveOwner", () => {
  it("returns true when demoting the last active owner", () => {
    assert.equal(
      wouldRemoveLastActiveOwner({
        ownerRoleId: "role_owner",
        membershipRoleId: "role_owner",
        membershipStatus: "active",
        nextRoleId: "role_member",
        nextStatus: "active",
        activeMemberships: [{ roleId: "role_owner", status: "active" }],
      }),
      true,
    );
  });

  it("returns false when another active owner exists", () => {
    assert.equal(
      wouldRemoveLastActiveOwner({
        ownerRoleId: "role_owner",
        membershipRoleId: "role_owner",
        membershipStatus: "active",
        nextRoleId: "role_member",
        nextStatus: "active",
        activeMemberships: [
          { roleId: "role_owner", status: "active" },
          { roleId: "role_owner", status: "active" },
        ],
      }),
      false,
    );
  });
});
