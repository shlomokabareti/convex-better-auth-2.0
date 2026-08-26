import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ApiAuthError } from "./errors";
import { parseAuthorizationBearerToken } from "./parseAuthorizationBearerToken";

describe("parseAuthorizationBearerToken", () => {
  it("returns bearer token for valid header", () => {
    assert.equal(parseAuthorizationBearerToken("Bearer token_123"), "token_123");
    assert.equal(parseAuthorizationBearerToken("bearer token_456"), "token_456");
  });

  it("throws when header is missing", () => {
    assert.throws(
      () => parseAuthorizationBearerToken(null),
      (error: unknown) =>
        error instanceof ApiAuthError && error.code === "AUTHORIZATION_HEADER_MISSING",
    );
  });

  it("throws when header shape is invalid", () => {
    assert.throws(
      () => parseAuthorizationBearerToken("Basic abc123"),
      (error: unknown) =>
        error instanceof ApiAuthError && error.code === "AUTHORIZATION_HEADER_INVALID",
    );

    assert.throws(
      () => parseAuthorizationBearerToken("Bearer"),
      (error: unknown) =>
        error instanceof ApiAuthError && error.code === "AUTHORIZATION_HEADER_INVALID",
    );
  });
});
