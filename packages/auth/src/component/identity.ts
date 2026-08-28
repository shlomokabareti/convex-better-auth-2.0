import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";

const MAX_EMAIL_VERIFICATION_CODE_REVOKE_BATCH = 100;
const MAX_PASSWORD_RESET_SESSION_REVOKE_BATCH = 1000;

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

const accountInputValidator = v.object({
  credentialHash: v.string(),
});

const verificationCodeInputValidator = v.object({
  tokenHash: v.string(),
  expiresAt: v.number(),
});

const userReturnValidator = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const provisionResultValidator = v.object({
  userId: v.id("users"),
  identityId: v.optional(v.id("auth_identities")),
  createdUser: v.boolean(),
  linkedExistingIdentity: v.boolean(),
  duplicate: v.optional(v.boolean()),
  user: v.optional(userReturnValidator),
});

const identityLookupResultValidator = v.union(
  v.object({
    userId: v.id("users"),
    identityId: v.id("auth_identities"),
    identityKey: v.string(),
    email: v.optional(v.string()),
    emailVerified: v.boolean(),
  }),
  v.null(),
);

const listedIdentityValidator = v.object({
  identityId: v.id("auth_identities"),
  provider: v.string(),
  issuer: v.string(),
  subject: v.string(),
  email: v.optional(v.string()),
  emailVerified: v.boolean(),
});

const userAndAccountUserValidator = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const userAndAccountIdentityValidator = v.object({
  _id: v.id("auth_identities"),
  userId: v.id("users"),
  provider: v.string(),
  issuer: v.string(),
  subject: v.string(),
  email: v.optional(v.string()),
  emailVerified: v.boolean(),
});

const userAndAccountAccountValidator = v.object({
  _id: v.id("authAccounts"),
  userId: v.id("users"),
  provider: v.string(),
  issuer: v.string(),
  subject: v.string(),
  credentialHash: v.string(),
});

const userAndAccountResultValidator = v.union(
  v.null(),
  v.object({
    user: userAndAccountUserValidator,
    identity: userAndAccountIdentityValidator,
    account: userAndAccountAccountValidator,
  }),
);

const emailVerificationResultValidator = v.object({
  success: v.boolean(),
  user: v.optional(userReturnValidator),
  reason: v.optional(v.string()),
});

const passwordResetResultValidator = v.object({
  status: v.boolean(),
  user: v.optional(userReturnValidator),
  reason: v.optional(v.string()),
});

export const provisionFromIdentity = mutation({
  args: {
    identity: identityInputValidator,
    user: userProfileInputValidator,
    account: v.optional(accountInputValidator),
    verificationCode: v.optional(verificationCodeInputValidator),
    allowLink: v.optional(v.boolean()),
  },
  returns: provisionResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedEmail = normalizeEmail(args.user.email ?? args.identity.email);
    const allowLink = args.allowLink ?? true;
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

    if (!allowLink && existingUserByEmail && !existingIdentity) {
      const identitiesForUser = await ctx.db
        .query("auth_identities")
        .withIndex("by_user", (q) => q.eq("userId", existingUserByEmail._id))
        .take(1);
      return {
        userId: existingUserByEmail._id,
        identityId: identitiesForUser[0]?._id,
        createdUser: false,
        linkedExistingIdentity: false,
        duplicate: true,
        user: existingUserByEmail,
      };
    }

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
      await ctx.db.patch("auth_identities", existingIdentity._id, identityPatch);
      const userRecord = await ctx.db.get("users", userId);
      return {
        userId,
        identityId: existingIdentity._id,
        createdUser: false,
        linkedExistingIdentity: true,
        user: userRecord ? toUserReturn(userRecord) : undefined,
      };
    }

    const identityId = await ctx.db.insert("auth_identities", {
      ...identityPatch,
      createdAt: now,
    });

    if (args.account) {
      await ctx.db.insert("authAccounts", {
        userId,
        provider: args.identity.provider,
        issuer: args.identity.issuer,
        subject: args.identity.subject,
        credentialHash: args.account.credentialHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (args.verificationCode) {
      const existingCodes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "email_verification"))
        .take(MAX_EMAIL_VERIFICATION_CODE_REVOKE_BATCH);
      await Promise.all(
        existingCodes.map((code) => ctx.db.patch(code._id, { consumedAt: now, updatedAt: now })),
      );
      await ctx.db.insert("authVerificationCodes", {
        userId,
        type: "email_verification",
        tokenHash: args.verificationCode.tokenHash,
        expiresAt: args.verificationCode.expiresAt,
        consumedAt: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    const userRecord = await ctx.db.get("users", userId);
    return {
      userId,
      identityId,
      createdUser: user === null,
      linkedExistingIdentity: false,
      user: userRecord ? toUserReturn(userRecord) : undefined,
    };
  },
});

export const getUserAndAccount = query({
  args: { email: v.string() },
  returns: userAndAccountResultValidator,
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    if (!normalizedEmail) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    if (!user) {
      return null;
    }
    const identity = await findIdentityByUserAndProvider(ctx, {
      userId: user._id,
      provider: "password",
      issuer: "native",
    });
    if (!identity) {
      return null;
    }
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_issuer_subject", (q) =>
        q.eq("provider", "password").eq("issuer", "native").eq("subject", identity.subject),
      )
      .unique();
    if (!account) {
      return null;
    }
    return { user, identity, account };
  },
});

export const verifyEmail = mutation({
  args: {
    tokenHash: v.string(),
    provider: v.string(),
    issuer: v.string(),
  },
  returns: emailVerificationResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_token_hash", (q) =>
        q.eq("tokenHash", args.tokenHash).eq("type", "email_verification"),
      )
      .unique();

    if (!code) {
      return { success: false, reason: "invalid" };
    }

    if (code.consumedAt || code.expiresAt <= now) {
      return { success: false, reason: "expired" };
    }

    const identity = await findIdentityByUserAndProvider(ctx, {
      userId: code.userId,
      provider: args.provider,
      issuer: args.issuer,
    });

    if (identity) {
      await ctx.db.patch(identity._id, { emailVerified: true, updatedAt: now });
    }

    await ctx.db.patch("users", code.userId, { emailVerified: true, updatedAt: now });
    await ctx.db.patch(code._id, { consumedAt: now, updatedAt: now });

    const userRecord = await ctx.db.get("users", code.userId);
    return { success: true, user: userRecord ? toUserReturn(userRecord) : undefined };
  },
});

export const resetPassword = mutation({
  args: {
    tokenHash: v.string(),
    credentialHash: v.string(),
    provider: v.string(),
    issuer: v.string(),
    revokeSessions: v.optional(v.boolean()),
  },
  returns: passwordResetResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const code = await ctx.db
      .query("authVerificationCodes")
      .withIndex("by_token_hash", (q) =>
        q.eq("tokenHash", args.tokenHash).eq("type", "password_reset"),
      )
      .unique();

    if (!code || code.consumedAt || code.expiresAt <= now) {
      return { status: false, reason: !code ? "invalid" : "expired" };
    }

    const identity = await findIdentityByUserAndProvider(ctx, {
      userId: code.userId,
      provider: args.provider,
      issuer: args.issuer,
    });
    if (!identity) {
      return { status: false, reason: "invalid" };
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("by_provider_issuer_subject", (q) =>
        q.eq("provider", args.provider).eq("issuer", args.issuer).eq("subject", identity.subject),
      )
      .unique();
    if (!account) {
      return { status: false, reason: "invalid" };
    }

    const writes: Promise<unknown>[] = [
      ctx.db.patch(code._id, { consumedAt: now, updatedAt: now }),
      ctx.db.patch(account._id, { credentialHash: args.credentialHash, updatedAt: now }),
    ];

    if (args.revokeSessions) {
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("by_user", (q) => q.eq("userId", code.userId))
        .take(MAX_PASSWORD_RESET_SESSION_REVOKE_BATCH);

      for (const session of sessions) {
        if (session.revokedAt === undefined && session.expiresAt > now) {
          writes.push(ctx.db.patch(session._id, { revokedAt: now, updatedAt: now }));
        }
      }
    }

    await Promise.all(writes);

    const userRecord = await ctx.db.get("users", code.userId);
    return { status: true, user: userRecord ? toUserReturn(userRecord) : undefined };
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
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    return identity === null ? null : toIdentityLookupResult(identity);
  },
});

async function findIdentityByIdentityId(ctx: IdentityLookupCtx, identityId: string) {
  return await ctx.db
    .query("auth_identities")
    .withIndex("by_identity_id", (q) => q.eq("identityId", identityId))
    .unique();
}

async function findIdentityByProviderIssuerSubject(
  ctx: IdentityLookupCtx,
  args: { provider: string; issuer: string; subject: string },
) {
  return await ctx.db
    .query("auth_identities")
    .withIndex("by_provider_issuer_subject", (q) =>
      q.eq("provider", args.provider).eq("issuer", args.issuer).eq("subject", args.subject),
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

async function findIdentityByUserAndProvider(
  ctx: IdentityLookupCtx,
  args: { userId: Id<"users">; provider: string; issuer: string },
) {
  return await ctx.db
    .query("auth_identities")
    .withIndex("by_user_provider_issuer", (q) =>
      q.eq("userId", args.userId).eq("provider", args.provider).eq("issuer", args.issuer),
    )
    .first();
}

function toUserReturn(user: Doc<"users">) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
