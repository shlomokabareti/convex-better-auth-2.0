import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { parseExpoInvitationUrl } from "./invite-flow";

describe("convex expo invite flow", () => {
  it("extracts invitation_token from URL", () => {
    const result = parseExpoInvitationUrl(
      "plasma://accept-invite?invitation_token=abc123"
    );
    assert.equal(result.kind, "token");
    if (result.kind === "token") {
      assert.equal(result.token, "abc123");
    }
  });

  it("falls back to generic token param", () => {
    const result = parseExpoInvitationUrl(
      "https://example.com/invite?token=tok456"
    );
    assert.equal(result.kind, "token");
    if (result.kind === "token") {
      assert.equal(result.token, "tok456");
    }
  });

  it("returns none for missing token", () => {
    const result = parseExpoInvitationUrl("myapp://invite?other=param");
    assert.equal(result.kind, "none");
    assert.equal(result.reason, "no_token");
  });

  it("returns none for null url", () => {
    const result = parseExpoInvitationUrl(null);
    assert.equal(result.kind, "none");
  });

  it("returns none for invalid url", () => {
    const result = parseExpoInvitationUrl("not-a-url");
    assert.equal(result.kind, "none");
    assert.equal(result.reason, "invalid_url");
  });
});
