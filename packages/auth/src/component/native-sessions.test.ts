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
});
