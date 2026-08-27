import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

export const getNativeIdentityByUser = query({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
  },
  handler: async (ctx, args) => {
    const identities = await ctx.db
      .query("auth_identities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return identities.find((i) => i.provider === args.provider && i.issuer === args.issuer) ?? null;
  },
});

export const markEmailVerified = mutation({
  args: {
    identityId: v.id("auth_identities"),
    emailVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.identityId, {
      emailVerified: args.emailVerified,
      updatedAt: now,
    });
  },
});
