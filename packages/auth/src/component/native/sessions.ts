import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

const MAX_SESSIONS_PER_USER = 1000;

const userReturnValidator = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const rotateSessionResultValidator = v.union(
  v.null(),
  v.object({
    user: userReturnValidator,
    identityId: v.id("auth_identities"),
  }),
);

function toUserReturn(user: Doc<"users">): Infer<typeof userReturnValidator> {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

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

export const createSessionAndRefreshToken = mutation({
  args: {
    sessionId: v.string(),
    userId: v.id("users"),
    token: v.string(),
    sessionExpiresAt: v.number(),
    refreshTokenHash: v.string(),
    refreshTokenExpiresAt: v.number(),
  },
  returns: v.id("authSessions"),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("authRefreshTokens", {
      tokenHash: args.refreshTokenHash,
      sessionId: args.sessionId,
      userId: args.userId,
      expiresAt: args.refreshTokenExpiresAt,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("authSessions", {
      sessionId: args.sessionId,
      userId: args.userId,
      token: args.token,
      expiresAt: args.sessionExpiresAt,
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

export const rotateSession = mutation({
  args: {
    oldRefreshTokenHash: v.string(),
    newSessionId: v.string(),
    newSessionToken: v.string(),
    newSessionExpiresAt: v.number(),
    newSessionIpAddress: v.optional(v.string()),
    newSessionUserAgent: v.optional(v.string()),
    newRefreshTokenHash: v.string(),
    newRefreshTokenExpiresAt: v.number(),
    provider: v.string(),
    issuer: v.string(),
  },
  returns: rotateSessionResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();

    const refresh = await ctx.db
      .query("authRefreshTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.oldRefreshTokenHash))
      .unique();
    if (!refresh || refresh.revokedAt || refresh.expiresAt <= now) {
      return null;
    }

    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", refresh.sessionId))
      .unique();
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    const user = await ctx.db.get("users", refresh.userId);
    if (!user) {
      return null;
    }

    const identity = await ctx.db
      .query("auth_identities")
      .withIndex("by_user_provider_issuer", (q) =>
        q.eq("userId", refresh.userId).eq("provider", args.provider).eq("issuer", args.issuer),
      )
      .first();
    if (!identity) {
      return null;
    }

    await Promise.all([
      ctx.db.patch(refresh._id, { revokedAt: now, updatedAt: now }),
      ctx.db.patch(session._id, { revokedAt: now, updatedAt: now }),
    ]);

    await ctx.db.insert("authSessions", {
      sessionId: args.newSessionId,
      userId: refresh.userId,
      token: args.newSessionToken,
      expiresAt: args.newSessionExpiresAt,
      ipAddress: args.newSessionIpAddress,
      userAgent: args.newSessionUserAgent,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("authRefreshTokens", {
      tokenHash: args.newRefreshTokenHash,
      sessionId: args.newSessionId,
      userId: refresh.userId,
      expiresAt: args.newRefreshTokenExpiresAt,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { user: toUserReturn(user), identityId: identity._id };
  },
});
