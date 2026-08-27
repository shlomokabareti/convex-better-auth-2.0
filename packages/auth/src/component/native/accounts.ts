import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";

export const createAccount = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
    credentialHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("authAccounts", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getAccountBySubject = query({
  args: {
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_issuer_subject", (q) =>
        q.eq("provider", args.provider).eq("issuer", args.issuer).eq("subject", args.subject),
      )
      .unique();
  },
});
