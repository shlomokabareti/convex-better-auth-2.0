import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

export const recordAttempt = mutation({
  args: {
    identifier: v.string(),
    windowStart: v.number(),
    maxAttempts: v.number(),
  },
  returns: v.object({ allowed: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("authRateLimits")
      .withIndex("by_identifier_window", (q) =>
        q.eq("identifier", args.identifier).eq("windowStart", args.windowStart),
      )
      .unique();

    if (existing) {
      const nextCount = existing.count + 1;
      await ctx.db.patch(existing._id, { count: nextCount, updatedAt: now });
      return { allowed: nextCount <= args.maxAttempts, count: nextCount };
    }

    await ctx.db.insert("authRateLimits", {
      identifier: args.identifier,
      windowStart: args.windowStart,
      count: 1,
      createdAt: now,
      updatedAt: now,
    });
    return { allowed: true, count: 1 };
  },
});

export const checkRateLimit = query({
  args: {
    identifier: v.string(),
    windowStart: v.number(),
    maxAttempts: v.number(),
  },
  returns: v.object({ allowed: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("authRateLimits")
      .withIndex("by_identifier_window", (q) =>
        q.eq("identifier", args.identifier).eq("windowStart", args.windowStart),
      )
      .unique();

    const count = existing?.count ?? 0;
    return { allowed: count < args.maxAttempts, count };
  },
});

export const cleanupExpiredRateLimits = mutation({
  args: { before: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("authRateLimits")
      .withIndex("by_window", (q) => q.lt("windowStart", args.before))
      .take(1000);
    for (const record of records) {
      await ctx.db.delete("authRateLimits", record._id);
    }
    return records.length;
  },
});
