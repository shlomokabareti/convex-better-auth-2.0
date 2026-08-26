/**
 * Coverage for `createBetterAuthBridgeState` — composes the canonical
 * `AuthRuntimeStatus` consumers read in React from raw provider +
 * Convex auth bits. This is the entry point every consumer's
 * AuthRuntimeProvider feeds with.
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createBetterAuthBridgeState } from "./createBetterAuthBridgeState";

const providerLoaded = {
  isAuthenticated: true,
  isLoading: false,
  hasToken: true,
};
const providerLoadedNoToken = {
  isAuthenticated: true,
  isLoading: false,
  hasToken: false,
};
const providerLoading = {
  isAuthenticated: false,
  isLoading: true,
  hasToken: false,
};
const providerSignedOut = {
  isAuthenticated: false,
  isLoading: false,
  hasToken: false,
};

describe("createBetterAuthBridgeState", () => {
  it("returns providerState attached verbatim", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoaded,
      convexAuthenticated: true,
    });
    assert.equal(state.providerState, providerLoaded);
  });

  it("fully authenticated → runtimeStatus.state === 'convexReady'", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoaded,
      convexAuthenticated: true,
    });
    assert.equal(state.runtimeStatus.state, "convexReady");
    assert.equal(state.runtimeStatus.providerAuthenticated, true);
    assert.equal(state.runtimeStatus.tokenAvailable, true);
    assert.equal(state.runtimeStatus.convexAuthenticated, true);
  });

  it("provider loading → isRecovering true by default", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoading,
      convexAuthenticated: false,
    });
    assert.equal(state.runtimeStatus.isRecovering, true);
  });

  it("recovering override wins over providerState.isLoading default", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoaded,
      convexAuthenticated: false,
      recovering: true,
    });
    assert.equal(state.runtimeStatus.isRecovering, true);
  });

  it("terminalFailure=true → reauthRequired=true", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoaded,
      convexAuthenticated: true,
      terminalFailure: true,
    });
    assert.equal(state.runtimeStatus.reauthRequired, true);
  });

  it("terminalFailure default is false", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoaded,
      convexAuthenticated: true,
    });
    assert.equal(state.runtimeStatus.reauthRequired, false);
  });

  it("signedOut provider + no convex auth → providerAuthenticated false", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerSignedOut,
      convexAuthenticated: false,
    });
    assert.equal(state.runtimeStatus.providerAuthenticated, false);
    assert.equal(state.runtimeStatus.tokenAvailable, false);
    assert.equal(state.runtimeStatus.convexAuthenticated, false);
  });

  it("provider authed without token → tokenAvailable=false (token-pending state)", () => {
    const state = createBetterAuthBridgeState({
      providerState: providerLoadedNoToken,
      convexAuthenticated: false,
    });
    assert.equal(state.runtimeStatus.providerAuthenticated, true);
    assert.equal(state.runtimeStatus.tokenAvailable, false);
    assert.equal(state.runtimeStatus.convexAuthenticated, false);
  });
});
