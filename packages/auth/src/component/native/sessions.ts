import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

const MAX_SESSIONS_PER_USER = 1000;

export const createSession = mutation({
  args: {
    sessionId: v.string(),
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("authSessions", {
      ...args,
      ipAddress: undefined,
      userAgent: undefined,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const revokeSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (session) {
      await ctx.db.patch(session._id, { revokedAt: Date.now() });
    }
    return session?._id ?? null;
  },
});

export const listSessionsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_SESSIONS_PER_USER);
  },
});

export const getSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});

export const getSessionBySessionId = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();
  },
});

export const revokeSessionsForUser = mutation({
  args: {
    userId: v.id("users"),
    excludeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_SESSIONS_PER_USER);

    const active = sessions.filter(
      (session) => session.revokedAt === undefined && session.expiresAt > now,
    );

    let revoked = 0;
    for (const session of active) {
      if (args.excludeSessionId && session.sessionId === args.excludeSessionId) {
        continue;
      }
      await ctx.db.patch(session._id, { revokedAt: now, updatedAt: now });
      revoked++;
    }
    return revoked;
  },
});
