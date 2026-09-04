import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// A single proof delivers at most a few rows per event; cap to bound storage
// against a flood of unauthenticated POSTs to the (env-gated) sink route.
const MAX_ROWS_PER_EVENT = 20;

export const recordReceivedWebhook = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    deliveryHeader: v.optional(v.string()),
    signature: v.optional(v.string()),
    bodyJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhook_proof_sink")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .take(MAX_ROWS_PER_EVENT);
    if (existing.length >= MAX_ROWS_PER_EVENT) {
      return null;
    }
    await ctx.db.insert("webhook_proof_sink", {
      eventId: args.eventId,
      eventType: args.eventType,
      deliveryHeader: args.deliveryHeader,
      signature: args.signature,
      bodyJson: args.bodyJson,
      receivedAt: Date.now(),
    });
    return null;
  },
});

export const getReceivedWebhooks = internalQuery({
  args: { eventId: v.string() },
  returns: v.array(
    v.object({
      eventId: v.string(),
      eventType: v.string(),
      deliveryHeader: v.optional(v.string()),
      signature: v.optional(v.string()),
      bodyJson: v.string(),
      receivedAt: v.number(),
    }),
  ),
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db
      .query("webhook_proof_sink")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(MAX_ROWS_PER_EVENT);
    return rows.map((row) => ({
      eventId: row.eventId,
      eventType: row.eventType,
      deliveryHeader: row.deliveryHeader,
      signature: row.signature,
      bodyJson: row.bodyJson,
      receivedAt: row.receivedAt,
    }));
  },
});

export const clearReceivedWebhooks = internalMutation({
  args: { eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { eventId }) => {
    const rows = await ctx.db
      .query("webhook_proof_sink")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(MAX_ROWS_PER_EVENT);
    await Promise.all(rows.map((row) => ctx.db.delete("webhook_proof_sink", row._id)));
    return null;
  },
});
