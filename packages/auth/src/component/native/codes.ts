import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

const MAX_VERIFICATION_CODES_PER_USER = 1000;

export const createVerificationCode = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("email_verification"), v.literal("password_reset")),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .take(MAX_VERIFICATION_CODES_PER_USER);

    await Promise.all(existing.map((code) => ctx.db.patch(code._id, { consumedAt: now })));

    return await ctx.db.insert("authVerificationCodes", {
      ...args,
      consumedAt: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getVerificationCodeByTokenHash = query({
  args: {
    tokenHash: v.string(),
    type: v.union(v.literal("email_verification"), v.literal("password_reset")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash).eq("type", args.type))
      .unique();
  },
});

export const consumeVerificationCode = mutation({
  args: {
    tokenHash: v.string(),
    type: v.union(v.literal("email_verification"), v.literal("password_reset")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash).eq("type", args.type))
      .unique();

    if (!code) {
      return null;
    }

    if (code.consumedAt || code.expiresAt <= now) {
      return null;
    }

    await ctx.db.patch(code._id, { consumedAt: now, updatedAt: now });
    return (await ctx.db.get(code._id)) ?? null;
  },
});

export const revokeVerificationCodesForUser = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("email_verification"), v.literal("password_reset")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .take(MAX_VERIFICATION_CODES_PER_USER);

    const unconsumed = existing.filter((code) => code.consumedAt === undefined);

    await Promise.all(
      unconsumed.map((code) => ctx.db.patch(code._id, { consumedAt: now, updatedAt: now })),
    );

    return unconsumed.length;
  },
});
