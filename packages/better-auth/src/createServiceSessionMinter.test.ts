import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createAuthServiceSessionMinter,
  type ServiceSessionMintAudit,
} from "./createServiceSessionMinter";

// ---------------------------------------------------------------------------
// Proof matrix for Increment 6b — convex-auth-native service session (the
// agent-as-user / impersonation primitive). NO Better-Auth admin plugin.
//
// THE security invariants (highest-risk surface — password-less session mint):
//   1. GATE BAKED: `authorize` must resolve a principal; if it throws, the mint
//      is UNREACHABLE (internalAdapter.createSession is never called).
//   2. AUDIT BAKED: every successful mint fires `audit` with the acting
//      principal + target. If the audit write fails, the just-minted session is
//      REVOKED before the error propagates — no unaudited session survives.
//   3. NATIVE: mints via internalAdapter.createSession(targetUserId) — no
//      impersonatedBy override, so the default component schema suffices.
// ---------------------------------------------------------------------------

type FakeCtx = { marker: "ctx" };
const ctx: FakeCtx = { marker: "ctx" };

function only<T>(values: readonly T[], message: string): T {
  const [value] = values;
  assert.ok(value !== undefined, message);
  return value;
}

// findUserById resolves every id EXCEPT the sentinel "ghost_user" (which
// resolves to null) — lets a test prove the orphan-session guard rejects a
// target that does not exist.
const GHOST_USER_ID = "ghost_user";

function fakeRuntime(sessionToken = "minted-token") {
  const created: Array<{
    userId: string;
    dontRememberMe?: boolean;
    override?: unknown;
  }> = [];
  const deleted: string[] = [];
  const lookedUp: string[] = [];
  const internalAdapter = {
    createSession: async (
      userId: string,
      dontRememberMe?: boolean,
      override?: Record<string, unknown>,
    ) => {
      created.push({ userId, dontRememberMe, override });
      return { token: sessionToken, expiresAt: 1_780_000_000_000 };
    },
    deleteSession: async (token: string) => {
      deleted.push(token);
    },
    findUserById: async (userId: string) => {
      lookedUp.push(userId);
      return userId === GHOST_USER_ID ? null : { id: userId };
    },
  };
  const createAuth = () => ({
    $context: Promise.resolve({ internalAdapter }),
  });
  return { createAuth, created, deleted, lookedUp };
}

describe("createAuthServiceSessionMinter — security contract", () => {
  it("BLOCKS the mint when authorize throws (createSession never called)", async () => {
    const rt = fakeRuntime();
    const audits: unknown[] = [];
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => {
        throw new Error("FORBIDDEN: not allowed to impersonate");
      },
      audit: async (_c, e) => {
        audits.push(e);
      },
    });
    await assert.rejects(() => mintServiceSession(ctx, { targetUserId: "user_9" }), /FORBIDDEN/);
    assert.equal(rt.created.length, 0, "mint must not run when authorize denies");
    assert.equal(audits.length, 0);
  });

  it("mints natively + fires audit with the acting principal and target", async () => {
    const rt = fakeRuntime("tok-123");
    const audits: ServiceSessionMintAudit<{ id: string }>[] = [];
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => ({ id: "agent_principal_1" }),
      audit: async (_c, e) => {
        audits.push(e);
      },
    });
    const result = await mintServiceSession(ctx, {
      targetUserId: "user_9",
      reason: "agent run",
    });
    assert.deepEqual(result, {
      token: "tok-123",
      expiresAt: 1_780_000_000_000,
    });
    // native createSession: target + dontRememberMe default true + NO override (no impersonatedBy).
    assert.deepEqual(rt.created, [{ userId: "user_9", dontRememberMe: true, override: undefined }]);
    // audit carries the principal + request + result.
    assert.equal(audits.length, 1);
    const audit = only(audits, "service-session mint audit is missing");
    assert.deepEqual(audit.principal, { id: "agent_principal_1" });
    assert.equal(audit.request.targetUserId, "user_9");
    assert.equal(audit.request.reason, "agent run");
    // audit carries NON-SECRET metadata only — the session token must NOT be
    // exposed to the audit hook (a persisted token would be replayable).
    assert.deepEqual(audit.result, { expiresAt: 1_780_000_000_000 });
    assert.equal(
      Reflect.get(audit.result, "token"),
      undefined,
      "audit must never receive the session token",
    );
  });

  it("REVOKES the minted session when the audit write fails (no unaudited session)", async () => {
    const rt = fakeRuntime("tok-to-revoke");
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => ({ id: "p" }),
      audit: async () => {
        throw new Error("audit store unavailable");
      },
    });
    await assert.rejects(
      () => mintServiceSession(ctx, { targetUserId: "user_9" }),
      /audit store unavailable/,
    );
    assert.equal(rt.created.length, 1, "session was minted");
    assert.deepEqual(
      rt.deleted,
      ["tok-to-revoke"],
      "minted session must be revoked on audit failure",
    );
  });

  it("validates targetUserId BEFORE authorize (no work on a bad request)", async () => {
    const rt = fakeRuntime();
    let authorizeCalled = false;
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => {
        authorizeCalled = true;
        return { id: "p" };
      },
      audit: async () => {},
    });
    await assert.rejects(
      () => mintServiceSession(ctx, { targetUserId: "" }),
      /targetUserId is required/,
    );
    assert.equal(authorizeCalled, false);
    assert.equal(rt.created.length, 0);
  });

  it("REJECTS an unknown target (no orphan session minted, no audit)", async () => {
    const rt = fakeRuntime();
    const audits: unknown[] = [];
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => ({ id: "agent_principal_1" }),
      audit: async (_c, e) => {
        audits.push(e);
      },
    });
    await assert.rejects(
      () => mintServiceSession(ctx, { targetUserId: GHOST_USER_ID }),
      /target user not found/,
    );
    // authorize ran (gate cleared) and the target was looked up, but no
    // session was minted and nothing was audited.
    assert.deepEqual(rt.lookedUp, [GHOST_USER_ID]);
    assert.equal(rt.created.length, 0, "no session may be minted for a missing target");
    assert.equal(rt.deleted.length, 0);
    assert.equal(audits.length, 0);
  });

  it("passes through dontRememberMe=false when requested", async () => {
    const rt = fakeRuntime();
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth: rt.createAuth,
      authorize: async () => ({ id: "p" }),
      audit: async () => {},
    });
    await mintServiceSession(ctx, {
      targetUserId: "user_9",
      dontRememberMe: false,
    });
    assert.equal(only(rt.created, "created service session is missing").dontRememberMe, false);
  });

  it("normalizes a Date expiresAt to epoch millis", async () => {
    const created: unknown[] = [];
    const internalAdapter = {
      createSession: async () => {
        created.push(1);
        return { token: "t", expiresAt: new Date(1_780_000_000_000) };
      },
      deleteSession: async () => {},
      findUserById: async (userId: string) => ({ id: userId }),
    };
    const createAuth = () => ({
      $context: Promise.resolve({ internalAdapter }),
    });
    const { mintServiceSession } = createAuthServiceSessionMinter<FakeCtx, { id: string }>({
      createAuth,
      authorize: async () => ({ id: "p" }),
      audit: async () => {},
    });
    const result = await mintServiceSession(ctx, { targetUserId: "user_9" });
    assert.equal(result.expiresAt, 1_780_000_000_000);
  });
});
