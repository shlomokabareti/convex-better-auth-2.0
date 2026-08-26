import assert from "node:assert/strict";

import { v } from "convex/values";
import { describe, it } from "vitest";

import {
  createConvexApiKeyCreateArgsValidator,
  createConvexApiKeyIdArgsValidator,
  isConvexApiKeyCreateReplayInputMatch,
  isConvexApiKeyCreateReplayWindowOpen,
  normalizeConvexApiKeyCreateInput,
  resolveApiKeyRequestId,
  stringArraysEqual,
} from "./apiKeyLifecycle";

describe("api key lifecycle helpers", () => {
  it("normalizes optional request IDs", () => {
    assert.deepEqual(resolveApiKeyRequestId(undefined, { maxLength: 10 }), {
      ok: true,
      requestId: undefined,
    });
    assert.deepEqual(resolveApiKeyRequestId("  req_123  ", { maxLength: 10 }), {
      ok: true,
      requestId: "req_123",
    });
  });

  it("rejects long request IDs", () => {
    assert.deepEqual(resolveApiKeyRequestId("too-long", { maxLength: 3 }), {
      ok: false,
      reason: "too_long",
    });
  });

  it("compares ordered string arrays", () => {
    assert.equal(stringArraysEqual(["a", "b"], ["a", "b"]), true);
    assert.equal(stringArraysEqual(["b", "a"], ["a", "b"]), false);
    assert.equal(stringArraysEqual(["a"], ["a", "b"]), false);
  });

  it("normalizes create input and computes replay expiration", () => {
    assert.deepEqual(
      normalizeConvexApiKeyCreateInput({
        name: " Production ",
        scopes: ["organization:read"],
        allowedIpRanges: [" 203.0.113.10 ", "", "198.51.100.0/24"],
        requestId: " req_123 ",
        now: 1_000,
        replayWindowMs: 500,
      }),
      {
        ok: true,
        input: {
          name: "Production",
          scopes: ["organization:read"],
          allowedIpRanges: ["203.0.113.10", "198.51.100.0/24"],
          expiresAt: undefined,
          requestId: "req_123",
          requestIdExpiresAt: 1_500,
        },
      }
    );
  });

  it("rejects invalid create input before storage writes", () => {
    assert.deepEqual(
      normalizeConvexApiKeyCreateInput({
        name: " ",
        scopes: ["organization:read"],
      }),
      { ok: false, reason: "empty_name" }
    );
    assert.deepEqual(
      normalizeConvexApiKeyCreateInput({ name: "Production", scopes: [] }),
      {
        ok: false,
        reason: "empty_scopes",
      }
    );
    assert.deepEqual(
      normalizeConvexApiKeyCreateInput({
        name: "Production",
        scopes: ["organization:read"],
        requestId: "too-long",
        maxRequestIdLength: 3,
      }),
      { ok: false, reason: "request_id_too_long" }
    );
    assert.deepEqual(
      normalizeConvexApiKeyCreateInput({
        name: "Production",
        scopes: ["organization:read"],
        expiresAt: 1_000,
        now: 1_000,
      }),
      { ok: false, reason: "expires_at_not_future" }
    );
  });

  it("checks replay input and replay window state", () => {
    const input = {
      name: "Production",
      scopes: ["organization:read"],
      allowedIpRanges: ["203.0.113.10"],
      expiresAt: 2_000,
    };

    assert.equal(isConvexApiKeyCreateReplayInputMatch(input, input), true);
    assert.equal(
      isConvexApiKeyCreateReplayInputMatch(
        { ...input, allowedIpRanges: ["198.51.100.10"] },
        input
      ),
      false
    );
    assert.equal(
      isConvexApiKeyCreateReplayWindowOpen(
        { status: "active", requestIdExpiresAt: 2_000 },
        1_999
      ),
      true
    );
    assert.equal(
      isConvexApiKeyCreateReplayWindowOpen(
        { status: "active", requestIdExpiresAt: 2_000 },
        2_000
      ),
      false
    );
    assert.equal(
      isConvexApiKeyCreateReplayWindowOpen(
        { status: "revoked", requestIdExpiresAt: 2_000 },
        1_000
      ),
      false
    );
  });

  it("exports reusable Convex argument validators", () => {
    const createArgs = createConvexApiKeyCreateArgsValidator(v.string());
    const idArgs = createConvexApiKeyIdArgsValidator(v.string());

    assert.equal(createArgs.name.kind, "string");
    assert.equal(createArgs.scopes.kind, "array");
    assert.ok(createArgs.allowedIpRanges);
    assert.equal(idArgs.apiKeyId.kind, "string");
  });
});
