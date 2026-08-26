import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ApiAuthError } from "./errors";
import {
  matchesApiKeyTokenPrefix,
  parseApiCredential,
  resolveCredentialTypeFromBearerToken,
} from "./parseApiCredential";

describe("parseApiCredential", () => {
  it("resolves bearer tokens as user credentials by default", () => {
    assert.deepStrictEqual(
      parseApiCredential({
        authorizationHeader: "Bearer jwt.token.value",
        apiKeyTokenPrefixes: ["crm_live_"],
      }),
      {
        credentialType: "userBearer",
        token: "jwt.token.value",
      }
    );
  });

  it("resolves bearer tokens matching configured key prefixes as api keys", () => {
    assert.deepStrictEqual(
      parseApiCredential({
        authorizationHeader: "Bearer crm_live_123.secret",
        apiKeyTokenPrefixes: ["crm_live_"],
      }),
      {
        credentialType: "apiKeyBearer",
        token: "crm_live_123.secret",
      }
    );
  });

  it("resolves x-api-key headers as api keys", () => {
    assert.deepStrictEqual(
      parseApiCredential({
        apiKeyHeader: " crm_live_123.secret ",
        apiKeyTokenPrefixes: ["crm_live_"],
      }),
      {
        credentialType: "apiKeyBearer",
        token: "crm_live_123.secret",
      }
    );
  });

  it("rejects ambiguous credentials", () => {
    assert.throws(
      () =>
        parseApiCredential({
          authorizationHeader: "Bearer jwt.token.value",
          apiKeyHeader: "crm_live_123.secret",
          apiKeyTokenPrefixes: ["crm_live_"],
        }),
      (error: unknown) =>
        error instanceof ApiAuthError &&
        error.code === "API_CREDENTIAL_AMBIGUOUS"
    );
  });

  it("rejects unsupported x-api-key prefixes when configured", () => {
    assert.throws(
      () =>
        parseApiCredential({
          apiKeyHeader: "other_live_123.secret",
          apiKeyTokenPrefixes: ["crm_live_"],
        }),
      (error: unknown) =>
        error instanceof ApiAuthError && error.code === "API_KEY_HEADER_INVALID"
    );
  });

  it("requires either authorization or x-api-key", () => {
    assert.throws(
      () => parseApiCredential({ apiKeyTokenPrefixes: ["crm_live_"] }),
      (error: unknown) =>
        error instanceof ApiAuthError &&
        error.code === "AUTHORIZATION_HEADER_MISSING"
    );
  });
});

describe("resolveCredentialTypeFromBearerToken", () => {
  it("classifies configured prefixes without treating JWT dots as api keys", () => {
    assert.equal(
      resolveCredentialTypeFromBearerToken({
        token: "crm_live_123.secret",
        apiKeyTokenPrefixes: ["crm_live_"],
      }),
      "apiKeyBearer"
    );
    assert.equal(
      resolveCredentialTypeFromBearerToken({
        token: "header.payload.signature",
        apiKeyTokenPrefixes: ["crm_live_"],
      }),
      "userBearer"
    );
  });
});

describe("matchesApiKeyTokenPrefix", () => {
  it("trims and deduplicates prefixes before matching", () => {
    assert.equal(
      matchesApiKeyTokenPrefix("crm_live_123.secret", [
        " crm_live_ ",
        "crm_live_",
      ]),
      true
    );
    assert.equal(
      matchesApiKeyTokenPrefix("other_live_123.secret", ["crm_live_"]),
      false
    );
  });
});
