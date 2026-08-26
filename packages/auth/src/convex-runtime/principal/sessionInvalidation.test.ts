import assert from "node:assert/strict";

import { ConvexError } from "convex/values";
import { describe, it } from "vitest";

import type { ConvexUserIdentity } from "./resolveConvexUserContext";
import { requireLocalSessionValid, requireActiveSession } from "./sessionInvalidation";

describe("sessionInvalidation", () => {
  const okIdentity: ConvexUserIdentity = {
    subject: "user-1",
    issuer: "https://example.com",
    tokenIdentifier: "ti-1",
    sessionId: "sess-a",
  };

  it("requireLocalSessionValid passes when sessionId matches", () => {
    assert.doesNotThrow(() => requireLocalSessionValid(okIdentity, { sessionId: "sess-a" }));
  });

  it("requireLocalSessionValid throws ConvexError when sessionId mismatches", () => {
    assert.throws(
      () => requireLocalSessionValid(okIdentity, { sessionId: "sess-b" }),
      (e) => e instanceof ConvexError && e.data?.code === "UNAUTHORIZED",
    );
  });

  it("requireLocalSessionValid throws when local sessionId is null", () => {
    assert.throws(
      () => requireLocalSessionValid(okIdentity, { sessionId: null }),
      (e) => e instanceof ConvexError && e.data?.code === "UNAUTHORIZED",
    );
  });

  it("requireLocalSessionValid throws when identity has no sessionId", () => {
    const identity: ConvexUserIdentity = {
      ...okIdentity,
      sessionId: undefined,
    };
    assert.throws(
      () => requireLocalSessionValid(identity, { sessionId: "sess-a" }),
      (e) => e instanceof ConvexError && e.data?.code === "UNAUTHORIZED",
    );
  });

  it("requireActiveSession passes when both layers are valid", async () => {
    await assert.doesNotReject(() =>
      requireActiveSession(okIdentity, { sessionId: "sess-a" }, () => Promise.resolve(true)),
    );
  });

  it("requireActiveSession throws when Layer 2 says session missing", async () => {
    await assert.rejects(
      () => requireActiveSession(okIdentity, { sessionId: "sess-a" }, () => Promise.resolve(false)),
      (e) => e instanceof ConvexError && e.data?.code === "UNAUTHORIZED",
    );
  });

  it("requireActiveSession throws immediately when Layer 1 fails", async () => {
    await assert.rejects(
      () => requireActiveSession(okIdentity, { sessionId: "sess-b" }, () => Promise.resolve(true)),
      (e) => e instanceof ConvexError && e.data?.code === "UNAUTHORIZED",
    );
  });

  it("requireActiveSession throws when lookup rejects", async () => {
    await assert.rejects(
      () =>
        requireActiveSession(okIdentity, { sessionId: "sess-a" }, () =>
          Promise.reject(new Error("DB down")),
        ),
      (e: unknown) => e instanceof Error && e.message === "DB down",
    );
  });

  it("error includes authzCode SESSION_REQUIRED on Layer 1 failure", () => {
    try {
      requireLocalSessionValid(okIdentity, { sessionId: "sess-b" });
      assert.fail("expected throw");
    } catch (e) {
      assert.ok(e instanceof ConvexError);
      assert.equal(e.data.authzCode, "SESSION_REQUIRED");
      assert.equal(e.data.message, "Active session required");
    }
  });
});
