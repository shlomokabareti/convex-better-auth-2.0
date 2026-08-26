import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { OrganizationRoleTemplate } from "./invitationPolicy";
import { defaultOrganizationRoleCatalog } from "./roleCatalog";

const TEMPLATE_KEYS: readonly OrganizationRoleTemplate[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
];

describe("defaultOrganizationRoleCatalog", () => {
  it("returns one definition per role template key", () => {
    const catalog = defaultOrganizationRoleCatalog();
    const keys = catalog.map((role) => role.key);
    assert.deepEqual([...keys].toSorted(), [...TEMPLATE_KEYS].toSorted());
    assert.equal(new Set(keys).size, keys.length, "keys must be unique");
  });

  it("every definition has a non-empty name and permission list", () => {
    for (const role of defaultOrganizationRoleCatalog()) {
      assert.ok(role.name.length > 0, `${role.key} name must be non-empty`);
      assert.ok(
        role.description.length > 0,
        `${role.key} description must be non-empty`
      );
      assert.ok(
        role.permissions.length > 0,
        `${role.key} must have at least one permission`
      );
      assert.equal(typeof role.isSystem, "boolean");
    }
  });

  it("owner has wildcard permission and is a system role", () => {
    const owner = defaultOrganizationRoleCatalog().find(
      (role) => role.key === "owner"
    );
    assert.ok(owner);
    assert.deepEqual(owner.permissions, ["*"]);
    assert.equal(owner.isSystem, true);
  });

  it("admin is a system role without billing or org-delete authority", () => {
    const admin = defaultOrganizationRoleCatalog().find(
      (role) => role.key === "admin"
    );
    assert.ok(admin);
    assert.equal(admin.isSystem, true);
    assert.ok(!admin.permissions.includes("*"));
    assert.ok(!admin.permissions.includes("organization:billing:manage"));
    assert.ok(!admin.permissions.includes("organization:delete"));
  });

  it("manager, member, and viewer are non-system roles", () => {
    for (const key of ["manager", "member", "viewer"] as const) {
      const role = defaultOrganizationRoleCatalog().find(
        (entry) => entry.key === key
      );
      assert.ok(role);
      assert.equal(role.isSystem, false);
    }
  });

  it("viewer is read-only (no manage/write permissions)", () => {
    const viewer = defaultOrganizationRoleCatalog().find(
      (role) => role.key === "viewer"
    );
    assert.ok(viewer);
    for (const permission of viewer.permissions) {
      assert.ok(
        permission.endsWith(":read"),
        `viewer permission ${permission} must be read-only`
      );
    }
  });

  it("returns a fresh array on each call (no shared mutable state)", () => {
    const first = defaultOrganizationRoleCatalog();
    const second = defaultOrganizationRoleCatalog();
    assert.notEqual(first, second);
    first[0]?.permissions.push("mutation:should:not:leak");
    assert.ok(!second[0]?.permissions.includes("mutation:should:not:leak"));
  });
});
