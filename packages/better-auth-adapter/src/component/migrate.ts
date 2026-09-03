import { v } from "convex/values";
import { Migrations } from "@convex-dev/migrations";
import type { MigrationFunctionReference } from "@convex-dev/migrations";
import type { ComponentApi } from "@convex-dev/migrations/_generated/component.js";
import { makeFunctionReference } from "convex/server";
import type { FunctionHandle, GenericMutationCtx } from "convex/server";
import type { GenericId } from "convex/values";
import { internalMutation } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import type { DataModel, Doc } from "./_generated/dataModel.js";

type Ctx = GenericMutationCtx<DataModel>;

const migrationsComponent = (components as unknown as { migrations: ComponentApi }).migrations;

const migrations = new Migrations(migrationsComponent, {
  internalMutation,
});

type LegacyUser = {
  _id?: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: number;
  updatedAt: number;
  twoFactorEnabled: boolean | null;
  isAnonymous: boolean | null;
  username: string | null;
  displayUsername: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean | null;
  userId: string | null;
};

type LegacyAccount = {
  _id?: string;
  issuer: string | null;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
  scope: string | null;
  password: string | null;
  createdAt: number;
  updatedAt: number;
};

type LegacySession = {
  _id?: string;
  expiresAt: number;
  token: string;
  createdAt: number;
  updatedAt: number;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
};

type MigrateUserArgs = { legacyUser: LegacyUser };
type MigrateUserReturn = { userId: string };
type MigrateAccountArgs = {
  legacyAccount: LegacyAccount;
  userId: GenericId<"users">;
  email?: string;
  emailVerified?: boolean;
};
type MigrateAccountReturn = { identityId: string };
type MigrateSessionArgs = {
  legacySession: LegacySession;
  userId: GenericId<"users">;
};
type MigrateSessionReturn = { sessionId: string };

function userFromDoc(doc: Doc<"user">): LegacyUser {
  return {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    emailVerified: doc.emailVerified,
    image: doc.image ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    twoFactorEnabled: doc.twoFactorEnabled ?? null,
    isAnonymous: doc.isAnonymous ?? null,
    username: doc.username ?? null,
    displayUsername: doc.displayUsername ?? null,
    phoneNumber: doc.phoneNumber ?? null,
    phoneNumberVerified: doc.phoneNumberVerified ?? null,
    userId: doc.userId ?? null,
  };
}

function accountFromDoc(doc: Doc<"account">): LegacyAccount {
  return {
    _id: doc._id,
    issuer: doc.issuer ?? null,
    accountId: doc.accountId,
    providerId: doc.providerId,
    userId: doc.userId,
    accessToken: doc.accessToken ?? null,
    refreshToken: doc.refreshToken ?? null,
    idToken: doc.idToken ?? null,
    accessTokenExpiresAt: doc.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: doc.refreshTokenExpiresAt ?? null,
    scope: doc.scope ?? null,
    password: doc.password ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function sessionFromDoc(doc: Doc<"session">): LegacySession {
  return {
    _id: doc._id,
    expiresAt: doc.expiresAt,
    token: doc.token,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ipAddress: doc.ipAddress ?? null,
    userAgent: doc.userAgent ?? null,
    userId: doc.userId,
  };
}

async function getMigrationConfig(ctx: Ctx) {
  const config = await ctx.db.query("migrationConfig").unique();
  if (!config) {
    throw new Error(
      "Migration targets are not configured. Call setMigrationTargets with function handles for the convex-auth migration writers.",
    );
  }
  return config;
}

export const setMigrationTargets = internalMutation({
  args: {
    migrateUserHandle: v.string(),
    migrateAccountHandle: v.string(),
    migrateSessionHandle: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("migrationConfig").unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("migrationConfig", args);
    }
  },
});

export const migrateUsers = migrations.define({
  table: "user",
  migrateOne: async (ctx, doc) => {
    const config = await getMigrationConfig(ctx);
    const migrateUserHandle = config.migrateUserHandle as FunctionHandle<
      "mutation",
      MigrateUserArgs,
      MigrateUserReturn
    >;

    const result = await ctx.runMutation(migrateUserHandle, {
      legacyUser: userFromDoc(doc),
    });

    await ctx.db.insert("migrationUserIdMap", {
      legacyUserId: doc._id,
      newUserId: result.userId,
      email: doc.email.toLowerCase().trim(),
      emailVerified: doc.emailVerified,
    });
  },
});

export const migrateAccounts = migrations.define({
  table: "account",
  migrateOne: async (ctx, doc) => {
    const config = await getMigrationConfig(ctx);
    const mapping = await ctx.db
      .query("migrationUserIdMap")
      .withIndex("by_legacy_user_id", (q) => q.eq("legacyUserId", doc.userId))
      .unique();
    if (!mapping) {
      throw new Error(
        `No migrated user found for legacy user ${doc.userId} (account ${doc._id}). Run migrateUsers first.`,
      );
    }

    const migrateAccountHandle = config.migrateAccountHandle as FunctionHandle<
      "mutation",
      MigrateAccountArgs,
      MigrateAccountReturn
    >;

    await ctx.runMutation(migrateAccountHandle, {
      legacyAccount: accountFromDoc(doc),
      userId: mapping.newUserId as GenericId<"users">,
      email: mapping.email,
      emailVerified: mapping.emailVerified,
    });
  },
});

export const migrateSessions = migrations.define({
  table: "session",
  migrateOne: async (ctx, doc) => {
    const config = await getMigrationConfig(ctx);
    const mapping = await ctx.db
      .query("migrationUserIdMap")
      .withIndex("by_legacy_user_id", (q) => q.eq("legacyUserId", doc.userId))
      .unique();
    if (!mapping) {
      throw new Error(
        `No migrated user found for legacy user ${doc.userId} (session ${doc._id}). Run migrateUsers first.`,
      );
    }

    const migrateSessionHandle = config.migrateSessionHandle as FunctionHandle<
      "mutation",
      MigrateSessionArgs,
      MigrateSessionReturn
    >;

    await ctx.runMutation(migrateSessionHandle, {
      legacySession: sessionFromDoc(doc),
      userId: mapping.newUserId as GenericId<"users">,
    });
  },
});

const migrateUsersRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  Record<string, never>
>("migrate:migrateUsers") as unknown as MigrationFunctionReference;

const migrateAccountsRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  Record<string, never>
>("migrate:migrateAccounts") as unknown as MigrationFunctionReference;

const migrateSessionsRef = makeFunctionReference<
  "mutation",
  Record<string, never>,
  Record<string, never>
>("migrate:migrateSessions") as unknown as MigrationFunctionReference;

export const migrateAll = migrations.runner([
  migrateUsersRef,
  migrateAccountsRef,
  migrateSessionsRef,
]);
