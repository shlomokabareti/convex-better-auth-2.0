import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { internalMutation } from "./_generated/server.js";

const legacyUserValidator = v.object({
  _id: v.optional(v.string()),
  name: v.string(),
  email: v.string(),
  emailVerified: v.boolean(),
  image: v.optional(v.union(v.null(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
  twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
  isAnonymous: v.optional(v.union(v.null(), v.boolean())),
  username: v.optional(v.union(v.null(), v.string())),
  displayUsername: v.optional(v.union(v.null(), v.string())),
  phoneNumber: v.optional(v.union(v.null(), v.string())),
  phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
  userId: v.optional(v.union(v.null(), v.string())),
});

const legacyAccountValidator = v.object({
  _id: v.optional(v.string()),
  issuer: v.optional(v.union(v.null(), v.string())),
  accountId: v.string(),
  providerId: v.string(),
  userId: v.string(),
  accessToken: v.optional(v.union(v.null(), v.string())),
  refreshToken: v.optional(v.union(v.null(), v.string())),
  idToken: v.optional(v.union(v.null(), v.string())),
  accessTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
  refreshTokenExpiresAt: v.optional(v.union(v.null(), v.number())),
  scope: v.optional(v.union(v.null(), v.string())),
  password: v.optional(v.union(v.null(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const legacySessionValidator = v.object({
  _id: v.optional(v.string()),
  expiresAt: v.number(),
  token: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  ipAddress: v.optional(v.union(v.null(), v.string())),
  userAgent: v.optional(v.union(v.null(), v.string())),
  userId: v.string(),
});

/**
 * One-time migration from the Better Auth adapter schema into the native
 * convex-auth component. Run once, then remove the adapter.
 */
export const migrateFromBetterAuth = internalMutation({
  args: {
    users: v.array(legacyUserValidator),
    accounts: v.array(legacyAccountValidator),
    sessions: v.array(legacySessionValidator),
  },
  returns: v.object({
    usersCreated: v.number(),
    identitiesCreated: v.number(),
    accountsCreated: v.number(),
    sessionsCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    let usersCreated = 0;
    let identitiesCreated = 0;
    let accountsCreated = 0;
    let sessionsCreated = 0;

    const userIdMap = new Map<string, Id<"users">>();
    const userEmailMap = new Map<Id<"users">, string>();
    const userEmailVerifiedMap = new Map<Id<"users">, boolean>();

    for (const legacyUser of args.users) {
      const legacyId = legacyUser._id ?? legacyUser.userId;
      const userId = await ctx.db.insert("users", {
        email: legacyUser.email.toLowerCase().trim(),
        name: legacyUser.name,
        image: legacyUser.image ?? undefined,
        emailVerified: legacyUser.emailVerified,
        twoFactorEnabled: legacyUser.twoFactorEnabled ?? undefined,
        isActive: true,
        createdAt: legacyUser.createdAt,
        updatedAt: legacyUser.updatedAt,
      });
      usersCreated++;
      const key = legacyId ?? userId;
      userIdMap.set(key, userId);
      userEmailMap.set(userId, legacyUser.email.toLowerCase().trim());
      userEmailVerifiedMap.set(userId, legacyUser.emailVerified);
    }

    for (const legacyAccount of args.accounts) {
      const userId = userIdMap.get(legacyAccount.userId);
      if (userId === undefined) {
        // Account with no matching user; skip.
        continue;
      }

      const provider =
        legacyAccount.providerId === "email" ? "convex-auth" : legacyAccount.providerId;
      const issuer = legacyAccount.issuer ?? provider;
      const subject = legacyAccount.accountId;
      const tokenIdentifier = `${issuer}|${subject}`;

      await ctx.db.insert("auth_identities", {
        identityId: tokenIdentifier,
        userId,
        provider,
        issuer,
        subject,
        tokenIdentifier,
        email: userEmailMap.get(userId),
        emailVerified: userEmailVerifiedMap.get(userId) ?? false,
        sessionId: undefined,
        createdAt: legacyAccount.createdAt,
        updatedAt: legacyAccount.updatedAt,
      });
      identitiesCreated++;

      await ctx.db.insert("authAccounts", {
        userId,
        provider,
        issuer,
        subject,
        credentialHash: legacyAccount.password ?? "",
        accessToken: legacyAccount.accessToken ?? undefined,
        refreshToken: legacyAccount.refreshToken ?? undefined,
        idToken: legacyAccount.idToken ?? undefined,
        tokenType: undefined,
        scopes: legacyAccount.scope ? [legacyAccount.scope] : undefined,
        accessTokenExpiresAt: legacyAccount.accessTokenExpiresAt ?? undefined,
        refreshTokenExpiresAt: legacyAccount.refreshTokenExpiresAt ?? undefined,
        createdAt: legacyAccount.createdAt,
        updatedAt: legacyAccount.updatedAt,
      });
      accountsCreated++;
    }

    for (const legacySession of args.sessions) {
      const userId = userIdMap.get(legacySession.userId);
      if (userId === undefined) {
        continue;
      }

      await ctx.db.insert("authSessions", {
        sessionId: legacySession.token,
        userId,
        token: legacySession.token,
        expiresAt: legacySession.expiresAt,
        ipAddress: legacySession.ipAddress ?? undefined,
        userAgent: legacySession.userAgent ?? undefined,
        revokedAt: undefined,
        createdAt: legacySession.createdAt,
        updatedAt: legacySession.updatedAt,
      });
      sessionsCreated++;
    }

    return {
      usersCreated,
      identitiesCreated,
      accountsCreated,
      sessionsCreated,
    };
  },
});
