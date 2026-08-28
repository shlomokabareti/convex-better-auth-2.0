"use node";
import { action } from "../../component/_generated/server.js";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../../component/_generated/dataModel.js";
import { v } from "convex/values";
import {
  buildEmailVerificationUrl,
  createEmailVerificationEmailDraft,
} from "../account/emailVerificationEmail.js";
import {
  buildPasswordResetUrl,
  createPasswordResetEmailDraft,
} from "../account/passwordResetEmail.js";
import { mintToken, verifyToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateVerificationToken, hashToken, isTokenExpired } from "./tokens.js";
import type { NativeEmailAndPasswordComponentHandle, VerificationCodeType } from "./types.js";

export type EmailDraft = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSender = (draft: EmailDraft) => Promise<string>;

export type NativeEmailAndPasswordConfig = {
  email?: {
    from: string;
    appOrigin?: string;
    verifyPath?: string;
    resetPath?: string;
    sendEmail: EmailSender;
  };
  requireVerifiedEmail?: boolean;
  verificationCodeTtlMs?: number;
  passwordResetCodeTtlMs?: number;
  sessionTtlMs?: number;
  minPasswordLength?: number;
  maxPasswordLength?: number;
};

export type NativeEmailAndPasswordActions = {
  signUp: ReturnType<typeof action>;
  signIn: ReturnType<typeof action>;
  signOut: ReturnType<typeof action>;
  sendEmailVerification: ReturnType<typeof action>;
  verifyEmail: ReturnType<typeof action>;
  sendPasswordReset: ReturnType<typeof action>;
  resetPassword: ReturnType<typeof action>;
};

type EmailSendResult =
  | { status: "queued"; emailId: string }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string };

const DEFAULT_VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_CODE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MIN_PASSWORD_LENGTH = 8;
const DEFAULT_MAX_PASSWORD_LENGTH = 128;

// Approximation of the `z.email()` check used by Better Auth.
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_+-]\.?)+[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function validatePassword(
  password: string,
  minLength: number,
  maxLength: number,
): { valid: true } | { valid: false; reason: "too_short" | "too_long" } {
  if (password.length < minLength) {
    return { valid: false, reason: "too_short" };
  }
  if (password.length > maxLength) {
    return { valid: false, reason: "too_long" };
  }
  return { valid: true };
}

function resolveEmailConfig(args: NativeEmailAndPasswordConfig): {
  from?: string;
  appOrigin?: string;
  verifyPath: string;
  resetPath: string;
  sendEmail?: EmailSender;
} {
  const email = args.email;
  return {
    from: email?.from,
    appOrigin: email?.appOrigin,
    verifyPath: email?.verifyPath ?? "/verify-email",
    resetPath: email?.resetPath ?? "/reset-password",
    sendEmail: email?.sendEmail,
  };
}

export function nativeEmailAndPassword(
  component: NativeEmailAndPasswordComponentHandle,
  config: NativeEmailAndPasswordConfig = {},
): NativeEmailAndPasswordActions {
  const emailConfig = resolveEmailConfig(config);
  const verificationCodeTtlMs = config.verificationCodeTtlMs ?? DEFAULT_VERIFICATION_CODE_TTL_MS;
  const passwordResetCodeTtlMs =
    config.passwordResetCodeTtlMs ?? DEFAULT_PASSWORD_RESET_CODE_TTL_MS;
  const sessionTtlMs = config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const requireVerifiedEmail = config.requireVerifiedEmail ?? false;
  const minPasswordLength = config.minPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH;
  const maxPasswordLength = config.maxPasswordLength ?? DEFAULT_MAX_PASSWORD_LENGTH;

  const signUp = action({
    args: {
      email: v.string(),
      password: v.string(),
      name: v.string(),
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
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Invalid email");
      }
      const passwordValidation = validatePassword(
        args.password,
        minPasswordLength,
        maxPasswordLength,
      );
      if (!passwordValidation.valid) {
        throw new Error(
          passwordValidation.reason === "too_short"
            ? "Password is too short"
            : "Password is too long",
        );
      }
      const subject = crypto.randomUUID();
      const credentialHash = await hashPassword(args.password);

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
      const expiresAt = now + sessionTtlMs;
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
      if (!account || !(await verifyPassword(args.password, account.credentialHash))) {
        throw new Error("Invalid email or password");
      }

      if (requireVerifiedEmail && !user.emailVerified) {
        throw new Error("Email not verified");
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = now + sessionTtlMs;
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

  async function queueVerificationEmail(
    ctx: GenericActionCtx<DataModel>,
    args: {
      email: string;
      type: VerificationCodeType;
      urlBuilder: (token: string) => string | null;
      draftBuilder: (params: {
        from: string;
        to: string;
        url: string | null;
        expiresAt: number;
      }) => Promise<EmailDraft | { status: "not_configured"; reason: string }>;
      ttlMs: number;
    },
  ): Promise<EmailSendResult> {
    const now = Date.now();
    const emailConfig = resolveEmailConfig(config);

    if (!emailConfig.from || !emailConfig.sendEmail) {
      return { status: "not_configured", reason: "missing_email_config" };
    }

    const user = await ctx.runQuery(component.native.users.getUserByEmail, {
      email: args.email.toLowerCase().trim(),
    });

    if (!user) {
      return { status: "queued", emailId: "noop" };
    }

    const token = generateVerificationToken();
    const tokenHash = hashToken(token);
    const expiresAt = now + args.ttlMs;

    await ctx.runMutation(component.native.codes.createVerificationCode, {
      userId: user._id,
      type: args.type,
      tokenHash,
      expiresAt,
    });

    const url = args.urlBuilder(token);
    const draft = await args.draftBuilder({
      from: emailConfig.from,
      to: user.email ?? args.email,
      url,
      expiresAt,
    });

    if ("status" in draft) {
      return { status: "not_configured", reason: draft.reason };
    }

    if (url === null) {
      return { status: "not_configured", reason: "missing_url" };
    }

    try {
      const emailId = await emailConfig.sendEmail(draft);
      return { status: "queued", emailId };
    } catch (error) {
      return {
        status: "failed",
        reason: error instanceof Error ? error.message : "email_send_failed",
      };
    }
  }

  const sendEmailVerification = action({
    args: { email: v.string() },
    returns: v.object({
      status: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
      reason: v.optional(v.string()),
      emailId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      return queueVerificationEmail(ctx, {
        email: args.email,
        type: "email_verification",
        urlBuilder: (token) =>
          buildEmailVerificationUrl({
            token,
            appOrigin: emailConfig.appOrigin,
            verifyPath: emailConfig.verifyPath,
          }),
        draftBuilder: async (params) =>
          createEmailVerificationEmailDraft({
            from: params.from,
            to: params.to,
            verifyUrl: params.url,
            expiresAt: params.expiresAt,
          }),
        ttlMs: verificationCodeTtlMs,
      });
    },
  });

  const verifyEmail = action({
    args: { token: v.string() },
    returns: v.object({
      success: v.boolean(),
      reason: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      const tokenHash = hashToken(args.token);

      const code = await ctx.runQuery(component.native.codes.getVerificationCodeByTokenHash, {
        tokenHash,
        type: "email_verification",
      });

      if (!code) {
        return { success: false, reason: "invalid" };
      }

      if (isTokenExpired(code.expiresAt)) {
        await ctx.runMutation(component.native.codes.consumeVerificationCode, {
          tokenHash,
          type: "email_verification",
        });
        return { success: false, reason: "expired" };
      }

      const consumed = await ctx.runMutation(component.native.codes.consumeVerificationCode, {
        tokenHash,
        type: "email_verification",
      });

      if (!consumed) {
        return { success: false, reason: "invalid" };
      }

      const identity = await ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
        userId: consumed.userId,
        provider: "password",
        issuer: "native",
      });

      if (identity) {
        await ctx.runMutation(component.native.identities.markEmailVerified, {
          identityId: identity._id,
          emailVerified: true,
        });
      }

      await ctx.runMutation(component.native.users.markEmailVerified, {
        userId: consumed.userId,
        emailVerified: true,
      });

      return { success: true };
    },
  });

  const sendPasswordReset = action({
    args: { email: v.string() },
    returns: v.object({
      status: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
      reason: v.optional(v.string()),
      emailId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      return queueVerificationEmail(ctx, {
        email: args.email,
        type: "password_reset",
        urlBuilder: (token) =>
          buildPasswordResetUrl({
            token,
            appOrigin: emailConfig.appOrigin,
            resetPath: emailConfig.resetPath,
          }),
        draftBuilder: async (params) =>
          createPasswordResetEmailDraft({
            from: params.from,
            to: params.to,
            resetUrl: params.url,
            expiresAt: params.expiresAt,
          }),
        ttlMs: passwordResetCodeTtlMs,
      });
    },
  });

  const resetPassword = action({
    args: {
      token: v.string(),
      newPassword: v.string(),
    },
    returns: v.object({
      success: v.boolean(),
      reason: v.optional(v.string()),
      token: v.optional(v.string()),
      userId: v.optional(v.string()),
      identityId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      const passwordValidation = validatePassword(
        args.newPassword,
        minPasswordLength,
        maxPasswordLength,
      );
      if (!passwordValidation.valid) {
        return {
          success: false,
          reason:
            passwordValidation.reason === "too_short" ? "password_too_short" : "password_too_long",
        };
      }

      const tokenHash = hashToken(args.token);

      const code = await ctx.runQuery(component.native.codes.getVerificationCodeByTokenHash, {
        tokenHash,
        type: "password_reset",
      });

      if (!code) {
        return { success: false, reason: "invalid" };
      }

      if (isTokenExpired(code.expiresAt)) {
        await ctx.runMutation(component.native.codes.consumeVerificationCode, {
          tokenHash,
          type: "password_reset",
        });
        return { success: false, reason: "expired" };
      }

      const consumed = await ctx.runMutation(component.native.codes.consumeVerificationCode, {
        tokenHash,
        type: "password_reset",
      });

      if (!consumed) {
        return { success: false, reason: "invalid" };
      }

      const identity = await ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
        userId: consumed.userId,
        provider: "password",
        issuer: "native",
      });

      if (!identity) {
        return { success: false, reason: "invalid" };
      }

      const account = await ctx.runQuery(component.native.accounts.getAccountBySubject, {
        provider: "password",
        issuer: "native",
        subject: identity.subject,
      });

      if (!account) {
        return { success: false, reason: "invalid" };
      }

      const now = Date.now();
      const credentialHash = await hashPassword(args.newPassword);

      await ctx.runMutation(component.native.accounts.updateCredentialHash, {
        accountId: account._id,
        credentialHash,
      });

      const sessionId = crypto.randomUUID();
      const expiresAt = now + sessionTtlMs;
      const token = await mintToken(consumed.userId, sessionId, {
        identityId: identity._id,
      });

      await ctx.runMutation(component.native.sessions.createSession, {
        sessionId,
        userId: consumed.userId,
        token,
        expiresAt,
      });

      await ctx.runMutation(component.native.sessions.revokeSessionsForUser, {
        userId: consumed.userId,
        excludeSessionId: sessionId,
      });

      return {
        success: true,
        token,
        userId: consumed.userId,
        identityId: identity._id,
        sessionId,
      };
    },
  });

  return {
    signUp,
    signIn,
    signOut,
    sendEmailVerification,
    verifyEmail,
    sendPasswordReset,
    resetPassword,
  };
}
