import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

export const getNativeIdentityByUser = query({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_identities")
      .withIndex("by_user_provider_issuer", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider).eq("issuer", args.issuer),
      )
      .first();
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
