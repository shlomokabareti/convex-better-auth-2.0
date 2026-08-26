import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ApiAuthError, type ApiAuthErrorCode } from "./errors";
import {
  createApiAuthHttpErrorResponse,
  resolveApiAuthHttpErrorResponse,
  resolveApiAuthHttpStatus,
} from "./httpResponse";

describe("resolveApiAuthHttpStatus", () => {
  it("maps malformed credential requests to 400", () => {
    assert.equal(resolveApiAuthHttpStatus("API_CREDENTIAL_AMBIGUOUS"), 400);
    assert.equal(resolveApiAuthHttpStatus("API_KEY_HEADER_INVALID"), 400);
  });

  it("maps invalid or missing credentials to 401", () => {
    const codes: ApiAuthErrorCode[] = [
      "AUTHORIZATION_HEADER_MISSING",
      "AUTHORIZATION_HEADER_INVALID",
      "API_CREDENTIAL_INVALID",
      "API_CREDENTIAL_UNSUPPORTED",
      "API_KEY_EXPIRED",
      "API_KEY_INVALID",
      "OAUTH_SESSION_INVALID",
      "USER_IDENTITY_NOT_LINKED",
    ];

    for (const code of codes) {
      assert.equal(resolveApiAuthHttpStatus(code), 401, code);
    }
  });

  it("maps policy denials to 403", () => {
    assert.equal(resolveApiAuthHttpStatus("API_KEY_IP_FORBIDDEN"), 403);
    assert.equal(resolveApiAuthHttpStatus("API_KEY_IP_MISSING"), 403);
    assert.equal(resolveApiAuthHttpStatus("PRINCIPAL_RESTRICTED"), 403);
    assert.equal(resolveApiAuthHttpStatus("ORGANIZATION_ACCESS_DENIED"), 403);
    assert.equal(resolveApiAuthHttpStatus("SCOPE_FORBIDDEN"), 403);
  });
});

describe("resolveApiAuthHttpErrorResponse", () => {
  it("returns a stable body and authenticate header for ApiAuthError failures", () => {
    const response = resolveApiAuthHttpErrorResponse({
      error: new ApiAuthError(
        "AUTHORIZATION_HEADER_MISSING",
        "Authorization header is required."
      ),
    });

    assert.deepEqual(response, {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": "Bearer",
      },
      body: {
        ok: false,
        code: "AUTHORIZATION_HEADER_MISSING",
        message: "Authorization header is required.",
      },
    });
  });

  it("does not leak unexpected errors", () => {
    const response = resolveApiAuthHttpErrorResponse({
      error: new Error("database password leaked"),
    });

    assert.deepEqual(response, {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
      body: {
        ok: false,
        code: "API_AUTH_INTERNAL_ERROR",
        message: "Internal API auth error.",
      },
    });
  });
});

describe("createApiAuthHttpErrorResponse", () => {
  it("creates a Response from the recipe parts", async () => {
    const response = createApiAuthHttpErrorResponse({
      error: new ApiAuthError("PRINCIPAL_RESTRICTED", "Suspended account."),
      headers: {
        "x-request-id": "req_123",
      },
    });
    const body: unknown = await response.json();

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("x-request-id"), "req_123");
    assert.deepEqual(body, {
      ok: false,
      code: "PRINCIPAL_RESTRICTED",
      message: "Suspended account.",
    });
  });
});
