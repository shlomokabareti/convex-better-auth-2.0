import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

const MAX_REFRESH_TOKENS_PER_SESSION = 10;
const MAX_REFRESH_TOKENS_PER_USER = 1000;

export const createRefreshToken = mutation({
  args: {
    tokenHash: v.string(),
    sessionId: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  },
  returns: v.id("authRefreshTokens"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("authRefreshTokens", {
      ...args,
      revokedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getRefreshTokenByTokenHash = query({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("authRefreshTokens"),
      _creationTime: v.number(),
      tokenHash: v.string(),
      sessionId: v.string(),
      userId: v.id("users"),
      expiresAt: v.number(),
      revokedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authRefreshTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
  },
});

export const consumeRefreshToken = mutation({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("authRefreshTokens"),
      _creationTime: v.number(),
      tokenHash: v.string(),
      sessionId: v.string(),
      userId: v.id("users"),
      expiresAt: v.number(),
      revokedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = await ctx.db
      .query("authRefreshTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!token || token.revokedAt || token.expiresAt <= now) {
      return null;
    }
    await ctx.db.patch(token._id, { revokedAt: now, updatedAt: now });
    return { ...token, revokedAt: now, updatedAt: now };
  },
});

export const revokeRefreshTokensForSession = mutation({
  args: { sessionId: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .take(MAX_REFRESH_TOKENS_PER_SESSION);
    let revoked = 0;
    for (const token of tokens) {
      if (!token.revokedAt && token.expiresAt > now) {
        await ctx.db.patch(token._id, { revokedAt: now, updatedAt: now });
        revoked++;
      }
    }
    return revoked;
  },
});

export const revokeRefreshTokensForUser = mutation({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_REFRESH_TOKENS_PER_USER);
    let revoked = 0;
    for (const token of tokens) {
      if (!token.revokedAt && token.expiresAt > now) {
        await ctx.db.patch(token._id, { revokedAt: now, updatedAt: now });
        revoked++;
      }
    }
    return revoked;
  },
});
