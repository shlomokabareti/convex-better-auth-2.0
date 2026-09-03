import { v } from "convex/values";
import { getPage } from "convex-helpers/server/pagination";
import { mutation, query, type QueryCtx } from "../_generated/server.js";
import schema from "../schema.js";

async function countAttemptsInWindow(
  ctx: { db: QueryCtx["db"] },
  identifier: string,
  windowStart: number,
  maxAttempts: number,
) {
  const { page } = await getPage(ctx, {
    table: "authRateLimits",
    index: "by_identifier_window",
    startIndexKey: [identifier, windowStart],
    endIndexKey: [identifier, windowStart],
    absoluteMaxRows: maxAttempts + 1,
    schema,
  });
  return page.length;
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
    await ctx.db.insert("authRateLimits", {
      identifier: args.identifier,
      windowStart: args.windowStart,
      count: 1,
      createdAt: now,
      updatedAt: now,
    });

    const count = await countAttemptsInWindow(
      ctx,
      args.identifier,
      args.windowStart,
      args.maxAttempts,
    );
    return { allowed: count <= args.maxAttempts, count };
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
    const count = await countAttemptsInWindow(
      ctx,
      args.identifier,
      args.windowStart,
      args.maxAttempts,
    );
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
