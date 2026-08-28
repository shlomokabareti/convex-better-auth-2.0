/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

async function insertUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: "shlomo@example.com",
      name: "Shlomo",
      emailVerified: false,
      isActive: true,
      createdAt: 0,
      updatedAt: 0,
    }),
  );
}

async function insertIdentity(
  t: ReturnType<typeof convexTest>,
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("auth_identities", {
      identityId: "subject_1",
      userId,
      provider: "password",
      issuer: "native",
      subject: "subject_1",
      tokenIdentifier: "subject_1",
      email: "shlomo@example.com",
      emailVerified: false,
      sessionId: null,
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    }),
  );
}

describe("native sessions", () => {
  it("creates and lists sessions for a user", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUser(t);

    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-1",
      userId,
      token: "token-1",
      expiresAt: Date.now() + 1_000_000,
    });

    const sessions = await t.query(api.native.sessions.listSessionsByUser, { userId });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("session-1");
    expect(sessions[0].revokedAt).toBeUndefined();
  });

  it("revokes a session by session id", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUser(t);

    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-1",
      userId,
      token: "token-1",
      expiresAt: Date.now() + 1_000_000,
    });

    const id = await t.mutation(api.native.sessions.revokeSession, { sessionId: "session-1" });
    expect(id).not.toBeNull();

    const sessions = await t.query(api.native.sessions.listSessionsByUser, { userId });
    expect(sessions[0].revokedAt).toBeGreaterThan(0);
  });

  it("revokes active sessions for a user and skips the excluded session", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUser(t);

    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-1",
      userId,
      token: "token-1",
      expiresAt: Date.now() + 1_000_000,
    });
    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-2",
      userId,
      token: "token-2",
      expiresAt: Date.now() + 1_000_000,
    });
    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-3",
      userId,
      token: "token-3",
      expiresAt: Date.now() + 1_000_000,
    });

    const revoked = await t.mutation(api.native.sessions.revokeSessionsForUser, {
      userId,
      excludeSessionId: "session-3",
    });
    expect(revoked).toBe(2);

    const sessions = await t.query(api.native.sessions.listSessionsByUser, { userId });
    const bySessionId = Object.fromEntries(sessions.map((s) => [s.sessionId, s]));
    expect(bySessionId["session-1"].revokedAt).toBeGreaterThan(0);
    expect(bySessionId["session-2"].revokedAt).toBeGreaterThan(0);
    expect(bySessionId["session-3"].revokedAt).toBeUndefined();
  });

  it("does not revoke expired sessions", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUser(t);

    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-1",
      userId,
      token: "token-1",
      expiresAt: 1,
    });

    const revoked = await t.mutation(api.native.sessions.revokeSessionsForUser, { userId });
    expect(revoked).toBe(0);

    const sessions = await t.query(api.native.sessions.listSessionsByUser, { userId });
    expect(sessions[0].revokedAt).toBeUndefined();
  });

  it("rotateSession consumes the old refresh token and session and creates a new pair", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUser(t);
    await insertIdentity(t, userId);
    const now = Date.now();

    await t.mutation(api.native.sessions.createSession, {
      sessionId: "session-1",
      userId,
      token: "token-1",
      expiresAt: now + 1_000_000,
    });

    await t.mutation(api.native.refreshTokens.createRefreshToken, {
      tokenHash: "old-hash",
      sessionId: "session-1",
      userId,
      expiresAt: now + 1_000_000,
    });

    const result = await t.mutation(api.native.sessions.rotateSession, {
      oldRefreshTokenHash: "old-hash",
      newSessionId: "session-2",
      newSessionToken: "token-2",
      newSessionExpiresAt: now + 1_000_000,
      newRefreshTokenHash: "new-hash",
      newRefreshTokenExpiresAt: now + 1_000_000,
      provider: "password",
      issuer: "native",
    });

    expect(result).toMatchObject({
      user: {
        _id: userId,
        email: "shlomo@example.com",
      },
      identityId: expect.any(String),
    });

    const [oldSession, newSession, oldRefresh, newRefresh] = await t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query("authSessions")
          .withIndex("by_session_id", (q) => q.eq("sessionId", "session-1"))
          .unique(),
        ctx.db
          .query("authSessions")
          .withIndex("by_session_id", (q) => q.eq("sessionId", "session-2"))
          .unique(),
        ctx.db
          .query("authRefreshTokens")
          .withIndex("by_token_hash", (q) => q.eq("tokenHash", "old-hash"))
          .unique(),
        ctx.db
          .query("authRefreshTokens")
          .withIndex("by_token_hash", (q) => q.eq("tokenHash", "new-hash"))
          .unique(),
      ]),
    );

    expect(oldSession?.revokedAt).toBeDefined();
    expect(newSession?.sessionId).toBe("session-2");
    expect(newSession?.token).toBe("token-2");
    expect(oldRefresh?.revokedAt).toBeDefined();
    expect(newRefresh?.sessionId).toBe("session-2");
    expect(newRefresh?.userId).toBe(userId);
  });
});
