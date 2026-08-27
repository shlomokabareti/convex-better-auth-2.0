import { v } from "convex/values";
import { query } from "../_generated/server.js";

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
