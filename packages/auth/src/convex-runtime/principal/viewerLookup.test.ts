import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  anonymousViewerFailure,
  invalidSessionFailure,
  missingLocalIdentityFailure,
  missingUserFailure,
  resolveViewerLookup,
} from "./viewerLookup";

describe("viewerLookup", () => {
  it("returns a structured failure when lookup fails", () => {
    const result = resolveViewerLookup({
      failure: missingLocalIdentityFailure(),
    });

    assert.deepEqual(result, {
      ok: false,
      failure: {
        code: "LOCAL_IDENTITY_MISSING",
        message: "Local identity missing",
      },
    });
  });

  it("assembles a viewer when all pieces are available", () => {
    const result = resolveViewerLookup({
      pieces: {
        identity: {
          subject: "external-user-123",
          issuer: "https://issuer.example",
          tokenIdentifier: "issuer|identity_123",
          sid: "session_123",
        },
        localIdentity: { _id: "identity_123" },
        user: { _id: "user_123", isActive: true },
        userId: "user_123",
        identityId: "identity_123",
        access: {
          activeOrganizationId: "org_123",
          membershipIds: ["membership_1"],
          roleKeys: ["owner"],
          permissions: ["org:read"],
        },
        isRestricted: false,
        restrictedReason: null,
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error("expected viewer result");
    }

    assert.equal(result.viewer.authContext.principal.kind, "user");
    assert.equal(result.viewer.authContext.principal.userId, "user_123");
    assert.equal(result.viewer.authContext.principal.sessionId, "session_123");
    assert.equal(result.viewer.activeOrganizationId, "org_123");
    assert.equal(result.viewer.hasPermission("org:read"), true);
  });

  it("exposes standard failure constructors", () => {
    assert.deepEqual(anonymousViewerFailure(), {
      code: "ANONYMOUS",
      message: "Authentication required",
    });
    assert.deepEqual(invalidSessionFailure(), {
      code: "SESSION_INVALID",
      message: "Active session required",
    });
    assert.deepEqual(missingUserFailure(), {
      code: "USER_MISSING",
      message: "User not found",
    });
  });
});
