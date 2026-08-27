"use node";
import { action } from "../../component/_generated/server.js";
import { v } from "convex/values";
import { mintToken, verifyToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

export type NativeEmailAndPasswordActions = {
  signUp: ReturnType<typeof action>;
  signIn: ReturnType<typeof action>;
  signOut: ReturnType<typeof action>;
};

export function nativeEmailAndPassword(
  component: NativeEmailAndPasswordComponentHandle,
): NativeEmailAndPasswordActions {
  const signUp = action({
    args: {
      email: v.string(),
      password: v.string(),
      name: v.optional(v.string()),
    },
    returns: v.object({
      token: v.string(),
      userId: v.string(),
      identityId: v.string(),
      sessionId: v.string(),
    }),
    handler: async (ctx, args) => {
      const now = Date.now();
      const normalizedEmail = args.email.trim().toLowerCase();
      const subject = crypto.randomUUID();
      const credentialHash = hashPassword(args.password);

      const { userId, identityId } = await ctx.runMutation(
        component.identity.provisionFromIdentity,
        {
          identity: {
            identityId: subject,
            provider: "password",
            issuer: "native",
            subject,
            tokenIdentifier: subject,
            email: normalizedEmail,
            emailVerified: false,
            sessionId: null,
          },
          user: {
            email: normalizedEmail,
            name: args.name,
            emailVerified: false,
          },
        },
      );

      await ctx.runMutation(component.native.accounts.createAccount, {
        userId,
        provider: "password",
        issuer: "native",
        subject,
        credentialHash,
      });

      const sessionId = crypto.randomUUID();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
      const token = await mintToken(userId, sessionId, { identityId });

      await ctx.runMutation(component.native.sessions.createSession, {
        sessionId,
        userId,
        token,
        expiresAt,
      });

      return { token, userId, identityId, sessionId };
    },
  });

  const signIn = action({
    args: {
      email: v.string(),
      password: v.string(),
    },
    returns: v.object({
      token: v.string(),
      userId: v.string(),
      identityId: v.string(),
      sessionId: v.string(),
    }),
    handler: async (ctx, args) => {
      const now = Date.now();
      const normalizedEmail = args.email.trim().toLowerCase();

      const user = await ctx.runQuery(component.native.users.getUserByEmail, {
        email: normalizedEmail,
      });
      if (!user) {
        throw new Error("Invalid email or password");
      }

      const identity = await ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
        userId: user._id,
        provider: "password",
        issuer: "native",
      });
      if (!identity) {
        throw new Error("Invalid email or password");
      }

      const account = await ctx.runQuery(component.native.accounts.getAccountBySubject, {
        provider: "password",
        issuer: "native",
        subject: identity.subject,
      });
      if (!account || !verifyPassword(args.password, account.credentialHash)) {
        throw new Error("Invalid email or password");
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
      const token = await mintToken(user._id, sessionId, {
        identityId: identity._id,
      });

      await ctx.runMutation(component.native.sessions.createSession, {
        sessionId,
        userId: user._id,
        token,
        expiresAt,
      });

      return { token, userId: user._id, identityId: identity._id, sessionId };
    },
  });

  const signOut = action({
    args: { token: v.string() },
    returns: v.object({ success: v.boolean() }),
    handler: async (ctx, args) => {
      const payload = await verifyToken(args.token);
      const sessionId = payload.sessionId;
      if (typeof sessionId !== "string") {
        throw new Error("Invalid session token");
      }
      await ctx.runMutation(component.native.sessions.revokeSession, {
        sessionId,
      });
      return { success: true };
    },
  });

  return { signUp, signIn, signOut };
}
