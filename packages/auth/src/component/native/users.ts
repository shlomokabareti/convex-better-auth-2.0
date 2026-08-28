import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get("users", args.userId);
  },
});

export const markEmailVerified = mutation({
  args: {
    userId: v.id("users"),
    emailVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      emailVerified: args.emailVerified,
      updatedAt: now,
    });
  },
});
