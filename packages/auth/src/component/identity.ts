import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";

type IdentityLookupCtx = Pick<MutationCtx | QueryCtx, "db">;

const identityInputValidator = v.object({
  identityId: v.string(),
  provider: v.string(),
  issuer: v.string(),
  subject: v.string(),
  tokenIdentifier: v.string(),
  email: v.optional(v.string()),
  emailVerified: v.boolean(),
  sessionId: v.optional(v.union(v.string(), v.null())),
});

const userProfileInputValidator = v.object({
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
});

const provisionResultValidator = v.object({
  userId: v.id("users"),
  identityId: v.id("auth_identities"),
  createdUser: v.boolean(),
  linkedExistingIdentity: v.boolean(),
});

const identityLookupResultValidator = v.union(
  v.object({
    userId: v.id("users"),
    identityId: v.id("auth_identities"),
    identityKey: v.string(),
    email: v.optional(v.string()),
    emailVerified: v.boolean(),
  }),
  v.null()
);

const listedIdentityValidator = v.object({
  identityId: v.id("auth_identities"),
  provider: v.string(),
  issuer: v.string(),
  subject: v.string(),
  email: v.optional(v.string()),
  emailVerified: v.boolean(),
});

export const provisionFromIdentity = mutation({
  args: {
    identity: identityInputValidator,
    user: userProfileInputValidator,
  },
  returns: provisionResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedEmail = normalizeEmail(
      args.user.email ?? args.identity.email
    );
    const existingIdentity =
      (await findIdentityByIdentityId(ctx, args.identity.identityId)) ??
      (await findIdentityByProviderIssuerSubject(ctx, {
        provider: args.identity.provider,
        issuer: args.identity.issuer,
        subject: args.identity.subject,
      }));
    const existingUserByIdentity = existingIdentity
      ? await ctx.db.get("users", existingIdentity.userId)
      : null;
    const existingUserByEmail = normalizedEmail
      ? await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .unique()
      : null;
    const user = existingUserByIdentity ?? existingUserByEmail;

    const userPatch = {
      email: normalizedEmail ?? undefined,
      name: args.user.name,
      image: args.user.image,
      emailVerified: args.user.emailVerified,
      isActive: true,
      updatedAt: now,
    };

    const userId =
      user?._id ??
      (await ctx.db.insert("users", {
        ...userPatch,
        createdAt: now,
      }));

    if (user) {
      await ctx.db.patch("users", user._id, userPatch);
    }

    const identityPatch = {
      identityId: args.identity.identityId,
      userId,
      provider: args.identity.provider,
      issuer: args.identity.issuer,
      subject: args.identity.subject,
      tokenIdentifier: args.identity.tokenIdentifier,
      email: normalizeEmail(args.identity.email) ?? undefined,
      emailVerified: args.identity.emailVerified,
      sessionId: args.identity.sessionId ?? null,
      updatedAt: now,
    };

    if (existingIdentity) {
      await ctx.db.patch(
        "auth_identities",
        existingIdentity._id,
        identityPatch
      );
      return {
        userId,
        identityId: existingIdentity._id,
        createdUser: false,
        linkedExistingIdentity: true,
      };
    }

    const identityId = await ctx.db.insert("auth_identities", {
      ...identityPatch,
      createdAt: now,
    });

    return {
      userId,
      identityId,
      createdUser: user === null,
      linkedExistingIdentity: false,
    };
  },
});

export const getByIdentity = query({
  args: {
    provider: v.string(),
    issuer: v.string(),
    subject: v.string(),
  },
  returns: identityLookupResultValidator,
  handler: async (ctx, args) => {
    const identity = await findIdentityByProviderIssuerSubject(ctx, args);
    return identity === null ? null : toIdentityLookupResult(identity);
  },
});

/**
 * List every identity row linked to the given component user. Used by
 * consumers that hold a component `userId` (e.g. from a membership row) and
 * need to recover the JWT subject/provider triple — for example, to surface
 * member lists keyed on the consumer's local identifier space, or to mint a
 * back-reference into the consumer's own users table.
 */
export const listByUser = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listedIdentityValidator),
  handler: async (ctx, { userId, paginationOpts }) => {
    const result = await ctx.db
      .query("auth_identities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        identityId: row._id,
        provider: row.provider,
        issuer: row.issuer,
        subject: row.subject,
        email: row.email,
        emailVerified: row.emailVerified,
      })),
    };
  },
});

export const getByTokenIdentifier = query({
  args: {
    tokenIdentifier: v.string(),
  },
  returns: identityLookupResultValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.db
      .query("auth_identities")
      .withIndex("by_token_identifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier)
      )
      .unique();
    return identity === null ? null : toIdentityLookupResult(identity);
  },
});

async function findIdentityByIdentityId(
  ctx: IdentityLookupCtx,
  identityId: string
) {
  return await ctx.db
    .query("auth_identities")
    .withIndex("by_identity_id", (q) => q.eq("identityId", identityId))
    .unique();
}

async function findIdentityByProviderIssuerSubject(
  ctx: IdentityLookupCtx,
  args: { provider: string; issuer: string; subject: string }
) {
  return await ctx.db
    .query("auth_identities")
    .withIndex("by_provider_issuer_subject", (q) =>
      q
        .eq("provider", args.provider)
        .eq("issuer", args.issuer)
        .eq("subject", args.subject)
    )
    .unique();
}

function toIdentityLookupResult(identity: Doc<"auth_identities">) {
  return {
    userId: identity.userId,
    identityId: identity._id,
    identityKey: identity.identityId,
    email: identity.email,
    emailVerified: identity.emailVerified,
  };
}

function normalizeEmail(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}
