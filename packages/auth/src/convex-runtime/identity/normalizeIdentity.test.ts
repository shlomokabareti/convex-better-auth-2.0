import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { identityRecordToNormalizedIdentity } from "./normalizeIdentity";
import type { AuthIdentityRecord } from "./types";

describe("identityRecordToNormalizedIdentity", () => {
  it("maps all fields from record", () => {
    const record: AuthIdentityRecord = {
      identityId: "id1",
      userId: "u1",
      provider: "enterprise-saml",
      subject: "sub1",
      issuer: "https://test.convex.site",
      tokenIdentifier: "https://test.convex.site|sub1",
      email: "test@test.com",
      emailVerified: true,
      sessionId: "sess1",
    };

    const normalized = identityRecordToNormalizedIdentity(record);

    assert.equal(normalized.provider, "enterprise-saml");
    assert.equal(normalized.subject, "sub1");
    assert.equal(normalized.issuer, "https://test.convex.site");
    assert.equal(normalized.tokenIdentifier, "https://test.convex.site|sub1");
    assert.equal(normalized.email, "test@test.com");
    assert.equal(normalized.emailVerified, true);
    assert.equal(normalized.sessionId, "sess1");
    assert.equal(normalized.name, null);
    assert.equal(normalized.imageUrl, null);
  });
});
