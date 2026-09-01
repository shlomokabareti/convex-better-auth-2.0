import { v } from "convex/values";
import { getPage } from "convex-helpers/server/pagination";
import { mutation, query, type QueryCtx } from "../_generated/server.js";
import schema from "../schema.js";

async function getRateLimitByIdentifierAndWindow(
  ctx: { db: QueryCtx["db"] },
  identifier: string,
  windowStart: number,
) {
  const { page } = await getPage(ctx, {
    table: "authRateLimits",
    index: "by_identifier_window",
    startIndexKey: [identifier, windowStart],
    endIndexKey: [identifier, windowStart],
    absoluteMaxRows: 1,
    schema,
  });
  return page[0] ?? null;
}

export const recordAttempt = mutation({
  args: {
    identifier: v.string(),
    windowStart: v.number(),
    maxAttempts: v.number(),
  },
  returns: v.object({ allowed: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getRateLimitByIdentifierAndWindow(
      ctx,
      args.identifier,
      args.windowStart,
    );

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
    const existing = await getRateLimitByIdentifierAndWindow(
      ctx,
      args.identifier,
      args.windowStart,
    );

    const count = existing?.count ?? 0;
    return { allowed: count < args.maxAttempts, count };
  },
});

export const cleanupExpiredRateLimits = mutation({
  args: { before: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { page: records } = await getPage(ctx, {
      table: "authRateLimits",
      index: "by_window",
      endIndexKey: [args.before],
      endInclusive: false,
      absoluteMaxRows: 1000,
      schema,
    });
    for (const record of records) {
      await ctx.db.delete("authRateLimits", record._id);
    }
    return records.length;
  },
});
