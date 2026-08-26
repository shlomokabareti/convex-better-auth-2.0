import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ResolvedAuthContext } from "../coreTypes";
import { requirePermission } from "./requirePermission";

const userContext = (permissions: string[]): ResolvedAuthContext => ({
  principal: {
    kind: "user",
    userId: "u1",
    identityId: "id1",
    activeOrganizationId: null,
    membershipIds: [],
    roleKeys: [],
    permissions,
    sessionId: null,
    isRestricted: false,
    restrictedReason: null,
  },
  execution: {
    organizationId: null,
    resourceType: null,
    resourceId: null,
    audience: null,
    scopes: [],
  },
});

describe("requirePermission", () => {
  it("allows held permission", () => {
    assert.doesNotThrow(() =>
      requirePermission(userContext(["org:read"]), "org:read")
    );
  });

  it("denies missing permission", () => {
    assert.throws(() =>
      requirePermission(userContext(["org:read"]), "org:write")
    );
  });

  it("allows apiKey effectivePermissions", () => {
    const ctx: ResolvedAuthContext = {
      principal: {
        kind: "apiKey",
        apiKeyId: "k1",
        ownerType: "user",
        ownerId: "u1",
        organizationId: null,
        inheritedPermissions: ["org:read"],
        narrowedPermissions: null,
        effectivePermissions: ["org:read"],
        isRestricted: false,
        restrictedReason: null,
      },
      execution: {
        organizationId: null,
        resourceType: null,
        resourceId: null,
        audience: null,
        scopes: [],
      },
    };
    assert.doesNotThrow(() => requirePermission(ctx, "org:read"));
  });
});
