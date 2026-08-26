import assert from "node:assert/strict";

import { permissionMatcherConformanceCases } from "convex-auth-core";
import { describe, it } from "vitest";

import { createApiKeyScopeRegistry, type ApiKeyScopeFromDescriptors } from "./api-key-scopes";

const scopeDescriptors = [
  {
    scope: "crm:read",
    requiredPermissions: ["crm:view"],
    defaultSelected: true,
  },
  {
    scope: "crm:write",
    requiredPermissions: ["crm:edit", "crm:manage"],
  },
  {
    scope: "crm:ping",
  },
] as const;

type TestScope = ApiKeyScopeFromDescriptors<typeof scopeDescriptors>;

describe("createApiKeyScopeRegistry", () => {
  for (const testCase of permissionMatcherConformanceCases) {
    it(`shared conformance: ${testCase.name}`, () => {
      const registry = createApiKeyScopeRegistry([
        {
          scope: "test:scope",
          requiredPermissions: [testCase.required],
        },
      ]);
      assert.equal(registry.canUseScope("test:scope", testCase.granted), testCase.expected);
    });
  }

  it("builds stable scope lists from descriptors", () => {
    const registry = createApiKeyScopeRegistry(scopeDescriptors);

    assert.deepEqual(registry.scopes, ["crm:read", "crm:write", "crm:ping"]);
    assert.deepEqual(registry.defaultScopes, ["crm:read"]);
  });

  it("normalizes, deduplicates, and validates scopes", () => {
    const registry = createApiKeyScopeRegistry(scopeDescriptors);

    assert.deepEqual(registry.normalizeScopes([" crm:read ", "unknown", "crm:read"]), ["crm:read"]);
    assert.deepEqual(registry.requireKnownScopes([" crm:read ", "crm:write", "crm:read"]), [
      "crm:read",
      "crm:write",
    ]);
    assert.throws(() => registry.requireKnownScopes(["unknown"]), /Unknown API key scope/);
  });

  it("checks scope permissions against descriptor requirements", () => {
    const registry = createApiKeyScopeRegistry(scopeDescriptors);

    assert.equal(registry.canUseScope("crm:read", ["crm:view"]), true);
    assert.equal(registry.canUseScope("crm:read", ["crm:*"]), true);
    assert.equal(registry.canUseScope("crm:read", ["*"]), true);
    assert.equal(registry.canUseScope("crm:write", ["crm:edit"]), true);
    assert.equal(registry.canUseScope("crm:write", ["crm:view"]), false);
    assert.equal(registry.canUseScope("crm:ping", []), true);
    assert.deepEqual(registry.filterUsableScopes(["crm:read", "crm:write"], ["crm:view"]), [
      "crm:read",
    ]);
  });

  it("does not let a domain wildcard satisfy a bare (non-namespaced) required permission", () => {
    // Parity with createPermissionEngine: a domain wildcard ("billing:*") matches
    // only namespaced permissions ("billing:read"), never a bare "billing". Before
    // the fix this returned true here and false in the engine — a scope-elevation gap.
    const registry = createApiKeyScopeRegistry([
      { scope: "billing:sync", requiredPermissions: ["billing"] },
    ] as const);

    assert.equal(registry.canUseScope("billing:sync", ["billing:*"]), false);
    assert.equal(registry.canUseScope("billing:sync", ["billing"]), true);
    assert.equal(registry.canUseScope("billing:sync", ["*"]), true);
  });

  it("rejects duplicate descriptors", () => {
    const duplicated = [{ scope: "crm:read" }, { scope: "crm:read" }] as const satisfies readonly {
      scope: TestScope;
    }[];

    assert.throws(() => createApiKeyScopeRegistry(duplicated), /Duplicate API key scope/);
  });
});
