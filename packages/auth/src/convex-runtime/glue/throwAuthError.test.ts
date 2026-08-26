/**
 * Coverage for `throwAuthError` + `isAuthErrorPayload`.
 *
 * The canonical auth-error helper every consumer's adapter calls. The
 * structured payload shape is what client-side branching, observability,
 * and i18n all depend on — lock it in.
 *
 * Coverage:
 *   1. throws ConvexError with code + message
 *   2. attaches authzCode when provided
 *   3. defaults message when omitted (one per AuthErrorAuthzCode value)
 *   4. falls back to code-level default when no authzCode
 *   5. consumer-supplied message overrides the default
 *   6. isAuthErrorPayload type guard accepts valid shapes
 *   7. isAuthErrorPayload rejects invalid shapes
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  isAuthErrorPayload,
  throwAuthError,
  type AuthErrorAuthzCode,
} from "./throwAuthError";

function catchThrow(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return typeof err === "object" && err !== null
      ? Reflect.get(err, "data")
      : undefined;
  }
  throw new assert.AssertionError({ message: "expected throw" });
}

describe("throwAuthError", () => {
  it("throws a ConvexError with code + default message when no authzCode", () => {
    const data = catchThrow(() => throwAuthError("FORBIDDEN"));
    assert.ok(isAuthErrorPayload(data));
    assert.equal(data.code, "FORBIDDEN");
    assert.equal(data.message, "Forbidden");
  });

  it("attaches authzCode when provided", () => {
    const data = catchThrow(() =>
      throwAuthError("FORBIDDEN", "PERMISSION_REQUIRED")
    );
    assert.ok(isAuthErrorPayload(data));
    assert.equal(data.code, "FORBIDDEN");
    assert.equal(data.authzCode, "PERMISSION_REQUIRED");
  });

  it("consumer-supplied message overrides default", () => {
    const data = catchThrow(() =>
      throwAuthError("UNAUTHORIZED", "AUTHENTICATION_REQUIRED", "custom msg")
    );
    assert.ok(isAuthErrorPayload(data));
    assert.equal(data.message, "custom msg");
  });

  it("default messages cover every AuthErrorAuthzCode value", () => {
    const expected: Record<AuthErrorAuthzCode, string> = {
      AUTHENTICATION_REQUIRED: "Authentication required",
      SESSION_REQUIRED: "Active session required",
      ORGANIZATION_REQUIRED: "Organization context required",
      PERMISSION_REQUIRED: "Permission required",
      PRINCIPAL_RESTRICTED: "Caller is restricted",
      USER_MISSING: "User not found",
      MEMBERSHIP_MISSING: "Not a member of this organization",
      ANCHOR_MISSING: "Organization anchor missing",
    };
    const authzCodes: readonly AuthErrorAuthzCode[] = [
      "AUTHENTICATION_REQUIRED",
      "SESSION_REQUIRED",
      "ORGANIZATION_REQUIRED",
      "PERMISSION_REQUIRED",
      "PRINCIPAL_RESTRICTED",
      "USER_MISSING",
      "MEMBERSHIP_MISSING",
      "ANCHOR_MISSING",
    ];
    for (const authzCode of authzCodes) {
      const data = catchThrow(() => throwAuthError("FORBIDDEN", authzCode));
      assert.ok(isAuthErrorPayload(data));
      assert.equal(data.message, expected[authzCode], `authzCode=${authzCode}`);
    }
  });

  it("default messages cover each code when no authzCode", () => {
    const ua = catchThrow(() => throwAuthError("UNAUTHORIZED"));
    assert.ok(isAuthErrorPayload(ua));
    assert.equal(ua.message, "Authentication required");
    const fb = catchThrow(() => throwAuthError("FORBIDDEN"));
    assert.ok(isAuthErrorPayload(fb));
    assert.equal(fb.message, "Forbidden");
    const nf = catchThrow(() => throwAuthError("NOT_FOUND"));
    assert.ok(isAuthErrorPayload(nf));
    assert.equal(nf.message, "Not found");
  });
});

describe("isAuthErrorPayload", () => {
  it("accepts a payload with code + message", () => {
    assert.equal(isAuthErrorPayload({ code: "FORBIDDEN", message: "x" }), true);
  });

  it("accepts a payload with code + authzCode + message", () => {
    assert.equal(
      isAuthErrorPayload({
        code: "UNAUTHORIZED",
        authzCode: "AUTHENTICATION_REQUIRED",
        message: "x",
      }),
      true
    );
  });

  it("rejects null, undefined, primitives", () => {
    assert.equal(isAuthErrorPayload(null), false);
    assert.equal(isAuthErrorPayload(undefined), false);
    assert.equal(isAuthErrorPayload("nope"), false);
    assert.equal(isAuthErrorPayload(42), false);
  });

  it("rejects payloads with unknown code", () => {
    assert.equal(isAuthErrorPayload({ code: "TEAPOT", message: "x" }), false);
  });

  it("rejects payloads missing message", () => {
    assert.equal(isAuthErrorPayload({ code: "FORBIDDEN" }), false);
  });

  it("rejects payloads with non-string message", () => {
    assert.equal(isAuthErrorPayload({ code: "FORBIDDEN", message: 42 }), false);
  });
});
