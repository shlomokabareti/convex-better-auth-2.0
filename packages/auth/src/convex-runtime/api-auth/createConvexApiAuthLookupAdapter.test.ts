import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createConvexApiAuthLookupAdapter } from "./createConvexApiAuthLookupAdapter";

describe("createConvexApiAuthLookupAdapter", () => {
  it("delegates lookup calls through runQuery with stable shapes", async () => {
    const calls: Array<{ reference: string; args: unknown }> = [];
    const adapter = createConvexApiAuthLookupAdapter({
      runUserIdentityQuery: async (reference, args) => {
        calls.push({ reference, args });
        return {
          userId: "user_123",
          identityId: "identity_123",
          activeOrganizationId: "org_123",
          membershipIds: ["membership_123"],
          roleKeys: ["owner"],
          permissions: ["org:read"],
          isRestricted: false,
          restrictedReason: null,
        };
      },
      runOrganizationAccessQuery: async (reference, args) => {
        calls.push({ reference, args });
        return {
          organizationId: "org_123",
          membershipIds: ["membership_123"],
          roleKeys: ["owner"],
          permissions: ["org:read"],
        };
      },
      refs: {
        getUserByIdentity: "getUserByIdentity",
        getOrganizationAccess: "getOrganizationAccess",
      },
    });

    const linkedUser = await adapter.getUserByIdentity({
      provider: "better-auth",
      issuer: "https://auth.example.com",
      subject: "user_123",
      tokenIdentifier: "https://auth.example.com|user_123",
    });
    const access = await adapter.getOrganizationAccess({
      userId: "user_123",
      requestedOrganizationId: "org_123",
      organizationHintId: null,
    });

    assert.deepStrictEqual(linkedUser, {
      userId: "user_123",
      identityId: "identity_123",
      activeOrganizationId: "org_123",
      membershipIds: ["membership_123"],
      roleKeys: ["owner"],
      permissions: ["org:read"],
      isRestricted: false,
      restrictedReason: null,
    });
    assert.deepStrictEqual(access, {
      organizationId: "org_123",
      membershipIds: ["membership_123"],
      roleKeys: ["owner"],
      permissions: ["org:read"],
    });
    assert.deepStrictEqual(calls, [
      {
        reference: "getUserByIdentity",
        args: {
          provider: "better-auth",
          issuer: "https://auth.example.com",
          subject: "user_123",
          tokenIdentifier: "https://auth.example.com|user_123",
        },
      },
      {
        reference: "getOrganizationAccess",
        args: {
          userId: "user_123",
          requestedOrganizationId: "org_123",
          organizationHintId: null,
        },
      },
    ]);
  });
});
