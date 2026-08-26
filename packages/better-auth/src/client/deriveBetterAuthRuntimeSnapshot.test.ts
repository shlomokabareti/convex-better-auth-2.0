import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { deriveBetterAuthRuntimeSnapshot } from "./deriveBetterAuthRuntimeSnapshot";

describe("deriveBetterAuthRuntimeSnapshot", () => {
  const baseSession = {
    data: {
      user: {
        id: "usr_1",
        email: "shlomo@example.com",
        emailVerified: true,
        name: "Shlomo",
        image: null,
      },
      session: {
        id: "ses_1",
        token: "valid-jwt",
      },
    } satisfies NonNullable<
      Parameters<typeof deriveBetterAuthRuntimeSnapshot>[0]["session"]["data"]
    >,
    isPending: false,
    isRefetching: false,
    error: null,
  } satisfies Parameters<typeof deriveBetterAuthRuntimeSnapshot>[0]["session"];

  it("returns convexReady when session + token + convex auth are all present", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: baseSession,
      convexAuthenticated: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "convexReady");
    assert.equal(snapshot.runtimeStatus.providerAuthenticated, true);
    assert.equal(snapshot.runtimeStatus.tokenAvailable, true);
    assert.equal(snapshot.runtimeStatus.convexAuthenticated, true);
    assert.equal(snapshot.runtimeStatus.isRecovering, false);
    assert.equal(snapshot.runtimeStatus.reauthRequired, false);
    assert.ok(snapshot.identity);
    assert.equal(snapshot.identity?.subject, "usr_1");
    assert.equal(snapshot.identity?.email, "shlomo@example.com");
    assert.equal(snapshot.error, null);
  });

  it("returns providerLoading when session is pending and not authenticated", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: true,
        isRefetching: false,
        error: null,
      },
      convexAuthenticated: false,
    });

    assert.equal(snapshot.runtimeStatus.state, "providerLoading");
    assert.equal(snapshot.runtimeStatus.providerAuthenticated, false);
    assert.equal(snapshot.runtimeStatus.isRecovering, false);
    assert.equal(snapshot.identity, null);
  });

  it("returns providerReady when user authenticated but token missing", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: {
          user: baseSession.data.user,
          session: { id: "ses_1", token: null },
        },
        isPending: false,
        isRefetching: false,
        error: null,
      },
      convexAuthenticated: false,
    });

    assert.equal(snapshot.runtimeStatus.state, "providerReady");
    assert.equal(snapshot.runtimeStatus.tokenAvailable, false);
    assert.equal(snapshot.runtimeStatus.convexAuthenticated, false);
  });

  it("returns tokenReady when token present but convex not authenticated", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: baseSession,
      convexAuthenticated: false,
    });

    assert.equal(snapshot.runtimeStatus.state, "tokenReady");
    assert.equal(snapshot.runtimeStatus.tokenAvailable, true);
    assert.equal(snapshot.runtimeStatus.convexAuthenticated, false);
  });

  it("returns reauthRequired on terminal failure", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: false,
        isRefetching: false,
        error: new Error("Session revoked"),
      },
      convexAuthenticated: false,
      terminalFailure: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "reauthRequired");
    assert.equal(snapshot.runtimeStatus.reauthRequired, true);
    assert.equal(snapshot.runtimeStatus.providerAuthenticated, false);
    assert.equal(snapshot.runtimeStatus.tokenAvailable, false);
    assert.equal(snapshot.identity, null);
  });

  it("returns reauthRequired when terminalFailure is true even with session data", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: baseSession,
      convexAuthenticated: true,
      terminalFailure: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "reauthRequired");
    assert.equal(snapshot.runtimeStatus.reauthRequired, true);
  });

  it("returns degraded when recovering after sign-out", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: false,
        isRefetching: true,
        error: null,
      },
      convexAuthenticated: false,
      recovering: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "degraded");
    assert.equal(snapshot.runtimeStatus.isRecovering, true);
    assert.equal(snapshot.runtimeStatus.providerAuthenticated, false);
  });

  it("returns convexConnecting when recovering with token but no convex auth", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: baseSession,
      convexAuthenticated: false,
      recovering: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "convexConnecting");
    assert.equal(snapshot.runtimeStatus.isRecovering, true);
    assert.equal(snapshot.runtimeStatus.tokenAvailable, true);
  });

  it("returns tokenRefreshing when recovering with valid user but no token", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: {
          user: baseSession.data.user,
          session: { id: "ses_1", token: null },
        },
        isPending: false,
        isRefetching: true,
        error: null,
      },
      convexAuthenticated: false,
      recovering: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "tokenRefreshing");
    assert.equal(snapshot.runtimeStatus.isRecovering, true);
    assert.equal(snapshot.runtimeStatus.tokenAvailable, false);
  });

  it("returns signedOut when not authenticated and not recovering", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
      },
      convexAuthenticated: false,
    });

    assert.equal(snapshot.runtimeStatus.state, "signedOut");
    assert.equal(snapshot.runtimeStatus.providerAuthenticated, false);
    assert.equal(snapshot.runtimeStatus.isRecovering, false);
    assert.equal(snapshot.identity, null);
  });

  it("preserves identity when session data exists with refetching", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: baseSession.data,
        isPending: false,
        isRefetching: true,
        error: null,
      },
      convexAuthenticated: true,
    });

    assert.equal(snapshot.runtimeStatus.state, "convexReady");
    assert.equal(snapshot.identity?.subject, "usr_1");
    assert.equal(snapshot.runtimeStatus.isRecovering, true);
  });

  it("maps session error into snapshot error", () => {
    const error = new Error("Network error");
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: false,
        isRefetching: false,
        error,
      },
      convexAuthenticated: false,
      terminalFailure: true,
    });

    assert.equal(snapshot.error, error);
    assert.equal(snapshot.runtimeStatus.state, "reauthRequired");
  });

  it("maps issuer into identity issuer correctly", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "custom-issuer.example.test",
      session: baseSession,
      convexAuthenticated: true,
    });

    assert.equal(snapshot.identity?.issuer, "custom-issuer.example.test");
  });

  it("returns null identity when session data is null", () => {
    const snapshot = deriveBetterAuthRuntimeSnapshot({
      issuer: "better-auth",
      session: {
        data: null,
        isPending: false,
        isRefetching: false,
        error: null,
      },
      convexAuthenticated: false,
    });

    assert.equal(snapshot.identity, null);
  });
});
