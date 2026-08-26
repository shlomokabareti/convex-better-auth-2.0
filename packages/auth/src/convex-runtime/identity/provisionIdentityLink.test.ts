import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { decideIdentityProvision, type ProvisionIdentityInput } from "./provisionIdentityLink";

const baseIdentity: ProvisionIdentityInput = {
  identityId: "identity_123",
  provider: "better-auth",
  subject: "user_123",
  issuer: "https://auth.example.com",
  tokenIdentifier: "https://auth.example.com|user_123",
  email: "demo@example.com",
  emailVerified: true,
  sessionId: "session_123",
};

describe("decideIdentityProvision", () => {
  it("reuses existing identity for repeated sign-in on same provider subject", () => {
    const decision = decideIdentityProvision({
      identity: baseIdentity,
      existingIdentityUserId: "user_local_existing",
      existingUserByEmailId: "user_local_by_email",
    });

    assert.deepStrictEqual(decision, {
      kind: "existingIdentity",
      userId: "user_local_existing",
      createdUser: false,
      linkedExistingIdentity: true,
      shouldCreateIdentity: false,
      shouldPatchIdentity: true,
    });
  });

  it("links verified different provider identity to same existing email owner", () => {
    const decision = decideIdentityProvision({
      identity: {
        ...baseIdentity,
        provider: "google",
        subject: "google_user_123",
        tokenIdentifier: "https://accounts.google.com|google_user_123",
      },
      existingIdentityUserId: null,
      existingUserByEmailId: "user_local_existing",
    });

    assert.deepStrictEqual(decision, {
      kind: "linkExistingUser",
      userId: "user_local_existing",
      createdUser: false,
      linkedExistingIdentity: false,
      shouldCreateIdentity: true,
      shouldPatchIdentity: false,
    });
  });

  it("does not link unverified provider email to an existing local user", () => {
    const decision = decideIdentityProvision({
      identity: {
        ...baseIdentity,
        provider: "google",
        subject: "google_user_123",
        tokenIdentifier: "https://accounts.google.com|google_user_123",
        emailVerified: false,
      },
      existingIdentityUserId: null,
      existingUserByEmailId: "user_local_existing",
    });

    assert.deepStrictEqual(decision, {
      kind: "createUser",
      createdUser: true,
      linkedExistingIdentity: false,
      shouldCreateIdentity: true,
      shouldPatchIdentity: false,
    });
  });

  it("creates new local user when no prior identity or email match exists", () => {
    const decision = decideIdentityProvision({
      identity: baseIdentity,
      existingIdentityUserId: null,
      existingUserByEmailId: null,
    });

    assert.deepStrictEqual(decision, {
      kind: "createUser",
      createdUser: true,
      linkedExistingIdentity: false,
      shouldCreateIdentity: true,
      shouldPatchIdentity: false,
    });
  });

  it("creates new local user for machine identity without email", () => {
    const decision = decideIdentityProvision({
      identity: {
        ...baseIdentity,
        email: null,
        emailVerified: false,
      },
      existingIdentityUserId: null,
      existingUserByEmailId: null,
    });

    assert.deepStrictEqual(decision, {
      kind: "createUser",
      createdUser: true,
      linkedExistingIdentity: false,
      shouldCreateIdentity: true,
      shouldPatchIdentity: false,
    });
  });
});
