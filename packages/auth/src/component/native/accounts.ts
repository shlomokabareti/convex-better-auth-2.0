import { v } from "convex/values";
import { mutation, query } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";

export const updateAccountTokens = mutation({
  args: {
    accountId: v.id("authAccounts"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const update: Partial<Doc<"authAccounts">> = {
      updatedAt: now,
    };
    if (args.accessToken !== undefined) update.accessToken = args.accessToken;
    if (args.refreshToken !== undefined) update.refreshToken = args.refreshToken;
    if (args.idToken !== undefined) update.idToken = args.idToken;
    if (args.tokenType !== undefined) update.tokenType = args.tokenType;
    if (args.scopes !== undefined) update.scopes = args.scopes;
    if (args.accessTokenExpiresAt !== undefined)
      update.accessTokenExpiresAt = args.accessTokenExpiresAt;
    if (args.refreshTokenExpiresAt !== undefined)
      update.refreshTokenExpiresAt = args.refreshTokenExpiresAt;
    await ctx.db.patch(args.accountId, update);
  },
});

export const updateCredentialHash = mutation({
  args: {
    accountId: v.id("authAccounts"),
    credentialHash: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.accountId, {
      credentialHash: args.credentialHash,
      updatedAt: now,
    });
  },
});

export const createAccount = mutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
    credentialHash: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
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
