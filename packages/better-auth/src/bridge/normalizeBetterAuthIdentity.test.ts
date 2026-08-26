import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { normalizeBetterAuthIdentity } from "./normalizeBetterAuthIdentity";

describe("normalizeBetterAuthIdentity", () => {
  it("uses Convex tokenIdentifier format", () => {
    const normalized = normalizeBetterAuthIdentity({
      subject: "user_123",
      issuer: "https://auth.example.com",
      email: "demo@example.com",
      emailVerified: true,
      sessionId: "session_123",
    });

    assert.equal(normalized.provider, "better-auth");
    assert.equal(
      normalized.tokenIdentifier,
      "https://auth.example.com|user_123"
    );
    assert.equal(normalized.sessionId, "session_123");
  });
});
