import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { rethrowWithAuthorizationDeniedAudit } from "./rethrowWithAuthorizationDeniedAudit";

describe("rethrowWithAuthorizationDeniedAudit", () => {
  it("writes extracted audit payload and rethrows original error", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const error = {
      data: {
        code: "FORBIDDEN",
        message: "Permission required: org:manage_roles",
        authzCode: "PERMISSION_REQUIRED",
        actorUserId: "user_123",
        principalKind: "user",
        principalId: "user_123",
        organizationId: "org_123",
        denialReason: "permission",
        resourceType: "convex.mutation",
        resourceId: "organizationRoles:createCustomRole",
        permission: "org:manage_roles",
      },
    };

    await assert.rejects(
      async () =>
        await rethrowWithAuthorizationDeniedAudit({
          error,
          writeAudit: async (payload) => {
            calls.push(payload);
          },
        }),
      (thrown) => thrown === error
    );

    assert.deepEqual(calls, [
      {
        actorUserId: "user_123",
        principalKind: "user",
        principalId: "user_123",
        organizationId: "org_123",
        denialReason: "permission",
        denialCode: "PERMISSION_REQUIRED",
        reasonDetail: "Permission required: org:manage_roles",
        resourceType: "convex.mutation",
        resourceId: "organizationRoles:createCustomRole",
        permission: "org:manage_roles",
      },
    ]);
  });

  it("skips audit write for non-authz errors and still rethrows", async () => {
    const error = new Error("boom");
    let calls = 0;

    await assert.rejects(
      async () =>
        await rethrowWithAuthorizationDeniedAudit({
          error,
          writeAudit: async () => {
            calls += 1;
          },
        }),
      (thrown) => thrown === error
    );

    assert.equal(calls, 0);
  });
});
