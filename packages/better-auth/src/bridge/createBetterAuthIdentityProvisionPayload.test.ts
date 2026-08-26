import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createBetterAuthIdentityProvisionPayload,
  createBetterAuthIdentityProvisionPayloadFromClaims,
} from "./createBetterAuthIdentityProvisionPayload";

describe("createBetterAuthIdentityProvisionPayload", () => {
  it("builds the Convex Auth component provision payload from sync inputs", () => {
    assert.deepEqual(
      createBetterAuthIdentityProvisionPayload({
        betterAuthUserId: "user_123",
        issuer: "https://auth.example.com/",
        email: " founder@example.com ",
        emailVerified: true,
        name: " Shlomo ",
        image: " https://cdn.example.com/avatar.png ",
      }),
      {
        identity: {
          identityId: "better-auth|https://auth.example.com|user_123",
          provider: "better-auth",
          issuer: "https://auth.example.com",
          subject: "user_123",
          tokenIdentifier: "https://auth.example.com|user_123",
          email: "founder@example.com",
          emailVerified: true,
          sessionId: null,
        },
        user: {
          email: "founder@example.com",
          emailVerified: true,
          name: "Shlomo",
          image: "https://cdn.example.com/avatar.png",
        },
      }
    );
  });

  it("builds the payload from Convex identity claims", () => {
    assert.deepEqual(
      createBetterAuthIdentityProvisionPayloadFromClaims(
        {
          subject: "user_456",
          issuer: "https://auth.example.com/",
          email: "user@example.com",
          emailVerified: false,
          name: "Operator",
          imageUrl: "https://cdn.example.com/operator.png",
          sid: "session_123",
        },
        { env: {} }
      ),
      {
        identity: {
          identityId: "better-auth|https://auth.example.com|user_456",
          provider: "better-auth",
          issuer: "https://auth.example.com",
          subject: "user_456",
          tokenIdentifier: "https://auth.example.com|user_456",
          email: "user@example.com",
          emailVerified: false,
          sessionId: "session_123",
        },
        user: {
          email: "user@example.com",
          emailVerified: false,
          name: "Operator",
          image: "https://cdn.example.com/operator.png",
        },
      }
    );
  });

  it("resolves issuer from explicit args when claims omit issuer", () => {
    assert.equal(
      createBetterAuthIdentityProvisionPayloadFromClaims(
        {
          subject: "user_789",
          email: "founder@example.com",
          emailVerified: true,
        },
        { issuer: "https://explicit.example.com" }
      ).identity.issuer,
      "https://explicit.example.com"
    );
  });

  it("rejects blank email after normalization", () => {
    assert.throws(
      () =>
        createBetterAuthIdentityProvisionPayload({
          betterAuthUserId: "user_123",
          issuer: "https://auth.example.com",
          email: " ",
          emailVerified: true,
        }),
      /Better Auth identity email is required/
    );
  });
});
