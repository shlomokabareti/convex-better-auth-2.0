import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  buildBetterAuthIdentityId,
  buildBetterAuthTokenIdentifier,
  buildAuthSentinelId,
  getBetterAuthIdentityProvider,
  isBetterAuthIdentity,
  isAuthSentinelId,
  readIdentityEmailVerified,
  readIdentitySessionId,
  readOptionalIdentityString,
  readRequiredIdentityEmail,
  resolveBetterAuthIdentityIssuer,
  resolveOptionalBetterAuthIdentityIssuer,
} from "./identityKeys";

describe("Better Auth identity keys", () => {
  it("builds stable component identity keys", () => {
    const issuer = "https://auth.example.com/";

    assert.equal(getBetterAuthIdentityProvider(), "better-auth");
    assert.equal(
      buildBetterAuthIdentityId("user_123", issuer),
      "better-auth|https://auth.example.com|user_123",
    );
    assert.equal(
      buildBetterAuthTokenIdentifier("user_123", issuer),
      "https://auth.example.com|user_123",
    );
  });

  it("resolves the issuer from explicit inputs before env", () => {
    const env = {
      BETTER_AUTH_ISSUER: "https://env-issuer.example.com",
      BETTER_AUTH_URL: "https://env-url.example.com/api/auth",
      CONVEX_SITE_URL: "https://env-convex.example.com",
    };

    assert.equal(
      resolveBetterAuthIdentityIssuer({
        issuer: "https://explicit-issuer.example.com/",
        baseURL: "https://explicit-base.example.com/api/auth",
        convexSiteUrl: "https://explicit-convex.example.com",
        env,
      }),
      "https://explicit-issuer.example.com",
    );
    assert.equal(
      resolveBetterAuthIdentityIssuer({
        baseURL: "https://explicit-base.example.com/api/auth",
        convexSiteUrl: "https://explicit-convex.example.com",
        env,
      }),
      "https://explicit-base.example.com",
    );
    assert.equal(
      resolveBetterAuthIdentityIssuer({
        convexSiteUrl: "https://explicit-convex.example.com/",
        env,
      }),
      "https://explicit-convex.example.com",
    );
  });

  it("resolves the issuer from env in Better Auth order", () => {
    assert.equal(
      resolveBetterAuthIdentityIssuer({
        env: {
          BETTER_AUTH_ISSUER: "https://issuer.example.com/",
          BETTER_AUTH_URL: "https://url.example.com/api/auth",
          CONVEX_SITE_URL: "https://convex.example.com",
        },
      }),
      "https://issuer.example.com",
    );
    assert.equal(
      resolveBetterAuthIdentityIssuer({
        env: {
          BETTER_AUTH_URL: "https://url.example.com/api/auth",
          CONVEX_SITE_URL: "https://convex.example.com",
        },
      }),
      "https://url.example.com",
    );
    assert.equal(
      resolveBetterAuthIdentityIssuer({
        env: {
          CONVEX_SITE_URL: "https://convex.example.com/",
        },
      }),
      "https://convex.example.com",
    );
  });

  it("returns null for optional issuer when configuration is absent", () => {
    assert.equal(resolveOptionalBetterAuthIdentityIssuer({ env: {} }), null);
  });

  it("detects Better Auth identities from the configured issuer", () => {
    assert.equal(
      isBetterAuthIdentity(
        {
          issuer: "https://auth.example.com/",
          tokenIdentifier: "https://auth.example.com|user_123",
        },
        { env: { BETTER_AUTH_ISSUER: "https://auth.example.com" } },
      ),
      true,
    );
    assert.equal(
      isBetterAuthIdentity(
        {
          issuer: "https://legacy.accounts.test",
          tokenIdentifier: "user_legacy_123",
        },
        { env: { BETTER_AUTH_ISSUER: "https://auth.example.com" } },
      ),
      false,
    );
  });

  it("marks Convex Auth sentinel ids", () => {
    const sentinel = buildAuthSentinelId("convex_user_123");

    assert.equal(sentinel, "CONVX_AUTH:convex_user_123");
    assert.equal(isAuthSentinelId(sentinel), true);
    assert.equal(isAuthSentinelId("user_legacy_123"), false);
  });

  it("reads normalized identity claims defensively", () => {
    const identity = {
      subject: "user_123",
      email: "founder@example.com",
      emailVerified: true,
      sid: "session_123",
      empty: "",
    };

    assert.equal(readRequiredIdentityEmail(identity), "founder@example.com");
    assert.equal(readIdentityEmailVerified(identity), true);
    assert.equal(readIdentitySessionId(identity), "session_123");
    assert.equal(readOptionalIdentityString(identity, "empty"), undefined);
  });
});
