import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { mapBetterAuthReadiness } from "./mapBetterAuthReadiness";
import type { BetterAuthBridgeInputs } from "./types";

describe("mapBetterAuthReadiness", () => {
  const base: BetterAuthBridgeInputs = {
    providerAuthenticated: true,
    providerLoading: false,
    tokenAvailable: true,
    convexAuthenticated: true,
    terminalFailure: false,
    recovering: false,
  };

  it("returns convexReady when all true", () => {
    assert.equal(mapBetterAuthReadiness(base), "convexReady");
  });

  it("returns signedOut when not authenticated", () => {
    assert.equal(mapBetterAuthReadiness({ ...base, providerAuthenticated: false }), "signedOut");
  });

  it("returns providerReady when token missing", () => {
    assert.equal(
      mapBetterAuthReadiness({
        ...base,
        tokenAvailable: false,
        convexAuthenticated: false,
      }),
      "providerReady",
    );
  });

  it("returns tokenReady when token present but convex not authenticated", () => {
    assert.equal(
      mapBetterAuthReadiness({
        ...base,
        convexAuthenticated: false,
      }),
      "tokenReady",
    );
  });

  it("returns reauthRequired on terminal failure", () => {
    assert.equal(mapBetterAuthReadiness({ ...base, terminalFailure: true }), "reauthRequired");
  });
});
