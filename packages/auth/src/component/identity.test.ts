/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { hashToken } from "../convex-runtime/native/tokens.js";

const modules = import.meta.glob("./**/*.*s");

describe("identity verification and password reset", () => {
  it("verifyEmail consumes the code and marks email verified", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "shlomo@example.com",
        name: "Shlomo",
        emailVerified: false,
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const identityId = await t.run(async (ctx) =>
      ctx.db.insert("auth_identities", {
        identityId: "subject_1",
        userId,
        provider: "password",
        issuer: "native",
        subject: "subject_1",
        tokenIdentifier: "subject_1",
        email: "shlomo@example.com",
        emailVerified: false,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const tokenHash = await hashToken("verify-token");
    await t.mutation(api.native.codes.createVerificationCode, {
      userId,
      type: "email_verification",
      tokenHash,
      expiresAt: Date.now() + 60_000,
    });

    const result = await t.mutation(api.identity.verifyEmail, {
      tokenHash,
      provider: "password",
      issuer: "native",
    });

    expect(result.success).toBe(true);
    expect(result.user?.emailVerified).toBe(true);

    const code = await t.query(api.native.codes.getVerificationCodeByTokenHash, {
      tokenHash,
      type: "email_verification",
    });
    expect(code?.consumedAt).toBeDefined();

    const identity = await t.run((ctx) => ctx.db.get("auth_identities", identityId as any));
    expect(identity?.emailVerified).toBe(true);

    const user = await t.run((ctx) => ctx.db.get("users", userId as any));
    expect(user?.emailVerified).toBe(true);
  });

  it("verifyEmail returns expired for an expired or consumed code", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "shlomo@example.com",
        name: "Shlomo",
        emailVerified: false,
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    await t.run(async (ctx) =>
      ctx.db.insert("auth_identities", {
        identityId: "subject_1",
        userId,
        provider: "password",
        issuer: "native",
        subject: "subject_1",
        tokenIdentifier: "subject_1",
        email: "shlomo@example.com",
        emailVerified: false,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const tokenHash = await hashToken("expired-token");
    await t.mutation(api.native.codes.createVerificationCode, {
      userId,
      type: "email_verification",
      tokenHash,
      expiresAt: 0,
    });

    const result = await t.mutation(api.identity.verifyEmail, {
      tokenHash,
      provider: "password",
      issuer: "native",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("resetPassword updates the credential hash and optionally revokes sessions", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        email: "shlomo@example.com",
        name: "Shlomo",
        emailVerified: true,
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const _identityId = await t.run(async (ctx) =>
      ctx.db.insert("auth_identities", {
        identityId: "subject_1",
        userId,
        provider: "password",
        issuer: "native",
        subject: "subject_1",
        tokenIdentifier: "subject_1",
        email: "shlomo@example.com",
        emailVerified: true,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const accountId = await t.run(async (ctx) =>
      ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        issuer: "native",
        subject: "subject_1",
        credentialHash: "old-hash",
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert("authSessions", {
        sessionId: "session_1",
        userId,
        token: "active-token",
        expiresAt: Date.now() + 60_000,
        createdAt: 0,
        updatedAt: 0,
      }),
    );

    const tokenHash = await hashToken("reset-token");
    await t.mutation(api.native.codes.createVerificationCode, {
      userId,
      type: "password_reset",
      tokenHash,
      expiresAt: Date.now() + 60_000,
    });

    const result = await t.mutation(api.identity.resetPassword, {
      tokenHash,
      credentialHash: "new-hash",
      provider: "password",
      issuer: "native",
      revokeSessions: true,
    });

    expect(result.status).toBe(true);

    const code = await t.query(api.native.codes.getVerificationCodeByTokenHash, {
      tokenHash,
      type: "password_reset",
    });
    expect(code?.consumedAt).toBeDefined();

    const account = await t.run((ctx) => ctx.db.get("authAccounts", accountId as any));
    expect(account?.credentialHash).toBe("new-hash");

    const session = await t.run((ctx) => ctx.db.get("authSessions", sessionId as any));
    expect(session?.revokedAt).toBeDefined();
  });

  it("resetPassword returns invalid for a missing code", async () => {
    const t = convexTest(schema, modules);

    const result = await t.mutation(api.identity.resetPassword, {
      tokenHash: await hashToken("missing"),
      credentialHash: "new-hash",
      provider: "password",
      issuer: "native",
    });

    expect(result.status).toBe(false);
    expect(result.reason).toBe("invalid");
  });
});
