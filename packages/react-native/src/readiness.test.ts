import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { mapExpoAuthReadiness } from "./readiness";

describe("convex expo auth readiness", () => {
  it("reports signed out after session resolves empty", () => {
    assert.equal(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: false, isLoading: false },
        session: { data: null, isPending: false },
      }).state,
      "signedOut"
    );
  });

  it("blocks protected Convex work while native session is loading", () => {
    assert.deepEqual(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: false, isLoading: false },
        session: { isPending: true },
      }),
      {
        convexAuthenticated: false,
        providerAuthenticated: false,
        reauthRequired: false,
        isRecovering: true,
        state: "providerLoading",
        tokenAvailable: false,
      }
    );
  });

  it("reports Convex connecting after Better Auth session is present", () => {
    assert.deepEqual(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: false, isLoading: true },
        session: { data: { user: { id: "user_1" } }, isPending: false },
      }),
      {
        convexAuthenticated: false,
        isRecovering: true,
        providerAuthenticated: true,
        reauthRequired: false,
        state: "convexConnecting",
        tokenAvailable: true,
      }
    );
  });

  it("reports Convex ready only after Convex auth confirms", () => {
    assert.equal(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: true, isLoading: false },
        session: { data: { user: { id: "user_1" } }, isPending: false },
      }).state,
      "convexReady"
    );
  });

  it("reports reauth required on session errors", () => {
    assert.deepEqual(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: false, isLoading: false },
        session: { error: new Error("expired"), isPending: false },
      }),
      {
        convexAuthenticated: false,
        isRecovering: false,
        providerAuthenticated: false,
        reauthRequired: true,
        state: "reauthRequired",
        tokenAvailable: false,
      }
    );
  });

  it("ignores null session errors", () => {
    assert.equal(
      mapExpoAuthReadiness({
        convex: { isAuthenticated: true, isLoading: false },
        session: {
          data: { user: { id: "user_1" } },
          error: null,
          isPending: false,
        },
      }).state,
      "convexReady"
    );
  });
});
