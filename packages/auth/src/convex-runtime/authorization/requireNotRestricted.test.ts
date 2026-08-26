import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ResolvedAuthContext } from "../coreTypes";
import { requireNotRestricted } from "./requireNotRestricted";

describe("requireNotRestricted", () => {
  it("allows unrestricted principal", () => {
    assert.doesNotThrow(() =>
      requireNotRestricted({
        principal: {
          kind: "service",
          serviceId: "svc_1",
          keyId: null,
          organizationId: null,
          permissions: [],
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
      })
    );
  });

  it("throws explicit restriction reason", () => {
    const context: ResolvedAuthContext = {
      principal: {
        kind: "apiKey",
        apiKeyId: "key_1",
        ownerType: "user",
        ownerId: "u1",
        organizationId: null,
        inheritedPermissions: [],
        narrowedPermissions: null,
        effectivePermissions: [],
        isRestricted: true,
        restrictedReason: "api_key_paused",
      },
      execution: {
        organizationId: null,
        resourceType: null,
        resourceId: null,
        audience: null,
        scopes: [],
      },
    };

    assert.throws(() => requireNotRestricted(context), /api_key_paused/);
  });
});
