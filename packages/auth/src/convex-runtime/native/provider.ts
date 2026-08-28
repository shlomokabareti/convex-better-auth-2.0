"use node";
import { action } from "../../component/_generated/server.js";
import type { FunctionReference, GenericActionCtx } from "convex/server";
import type { DataModel } from "../../component/_generated/dataModel.js";
import { v } from "convex/values";
import {
  buildEmailVerificationUrl,
  createEmailVerificationEmailDraft,
} from "../account/emailVerificationEmail.js";
import { trimTrailingSlash } from "../account/emailShared.js";
import {
  buildPasswordResetUrl,
  createPasswordResetEmailDraft,
} from "../account/passwordResetEmail.js";
import { mintToken, verifyToken } from "./jwt.js";
import { hashPassword, verifyPassword as verifyPasswordHash } from "./password.js";
import { generateVerificationToken, hashToken } from "./tokens.js";
import { handleUpdateSession } from "./updateSession.js";
import {
  type NativeAuthSession,
  type NativeAuthUser,
  type NativeEmailAndPasswordComponentHandle,
  nativeAuthUserValidator,
  toNativeAuthUser,
  type VerificationCodeType,
} from "./types.js";

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
    sendOnSignUp?: boolean;
    sendOnSignIn?: boolean;
  };
  enabled?: boolean;
  disableSignUp?: boolean;
  autoSignIn?: boolean;
  /** @deprecated use `email.sendOnSignUp` instead. */
  sendVerificationEmailOnSignUp?: boolean;
  /** @deprecated use `email.sendOnSignIn` instead. */
  sendVerificationEmailOnSignIn?: boolean;
  requireVerifiedEmail?: boolean;
  verificationCodeTtlMs?: number;
  passwordResetCodeTtlMs?: number;
  sessionTtlMs?: number;
  refreshTokenTtlMs?: number;
  minPasswordLength?: number;
  maxPasswordLength?: number;
  revokeSessionsOnPasswordReset?: boolean;
  onExistingUserSignUp?: (data: { user: NativeAuthUser }) => Promise<void>;
  onPasswordReset?: (data: { user: NativeAuthUser }) => Promise<void>;
};

export type NativeEmailAndPasswordActions = {
  signUp: ReturnType<typeof action>;
  signIn: ReturnType<typeof action>;
  signOut: ReturnType<typeof action>;
  updateSession: ReturnType<typeof action>;
  sendEmailVerification: ReturnType<typeof action>;
  verifyEmail: ReturnType<typeof action>;
  sendPasswordReset: ReturnType<typeof action>;
  resetPassword: ReturnType<typeof action>;
  verifyPassword: ReturnType<typeof action>;
};

export type NativeEmailAndPasswordFunctionReferences = {
  [K in keyof NativeEmailAndPasswordActions]: FunctionReference<"action", "public">;
};

type EmailSendResult =
  | { status: "queued"; emailId: string }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string };

const DEFAULT_VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD_RESET_CODE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DONT_REMEMBER_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MIN_PASSWORD_LENGTH = 8;
const DEFAULT_MAX_PASSWORD_LENGTH = 128;

// Approximation of the `z.email()` check used by Better Auth.
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_+-]\.?)+[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function buildGenericDuplicateResponse(
  email: string,
  name: string,
  image: string | undefined,
  now: number,
): NativeAuthSession {
  const syntheticUser: NativeAuthUser = {
    id: crypto.randomUUID(),
    email,
    name,
    image,
    emailVerified: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  return { token: null, user: syntheticUser };
}

function resolveSessionTtlMs(rememberMe: boolean | undefined, sessionTtlMs: number): number {
  return rememberMe === false ? DONT_REMEMBER_SESSION_TTL_MS : sessionTtlMs;
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

const nativeAuthSessionValidator = v.object({
  token: v.union(v.string(), v.null()),
  refreshToken: v.optional(v.string()),
  user: nativeAuthUserValidator,
  userId: v.optional(v.string()),
  identityId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  redirect: v.optional(v.boolean()),
  url: v.optional(v.string()),
});

function resolveEmailConfig(args: NativeEmailAndPasswordConfig): {
  from?: string;
  appOrigin?: string;
  verifyPath: string;
  resetPath: string;
  sendEmail?: EmailSender;
  sendOnSignUp?: boolean;
  sendOnSignIn?: boolean;
} {
  const email = args.email;
  return {
    from: email?.from,
    appOrigin: email?.appOrigin,
    verifyPath: email?.verifyPath ?? "/verify-email",
    resetPath: email?.resetPath ?? "/reset-password",
    sendEmail: email?.sendEmail,
    sendOnSignUp: email?.sendOnSignUp ?? args.sendVerificationEmailOnSignUp,
    sendOnSignIn: email?.sendOnSignIn ?? args.sendVerificationEmailOnSignIn,
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
  const enabled = config.enabled ?? true;
  const disableSignUp = config.disableSignUp ?? false;
  const autoSignIn = config.autoSignIn ?? true;
  const sendOnSignUp = emailConfig.sendOnSignUp;
  const sendOnSignIn = emailConfig.sendOnSignIn ?? false;
  const sessionTtlMs = config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const refreshTokenTtlMs = config.refreshTokenTtlMs ?? DEFAULT_REFRESH_TOKEN_TTL_MS;
  const requireVerifiedEmail = config.requireVerifiedEmail ?? false;
  const minPasswordLength = config.minPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH;
  const maxPasswordLength = config.maxPasswordLength ?? DEFAULT_MAX_PASSWORD_LENGTH;
  const onExistingUserSignUp = config.onExistingUserSignUp;

  const shouldReturnGenericDuplicateResponse = requireVerifiedEmail || autoSignIn === false;
  const shouldSkipAutoSignIn = shouldReturnGenericDuplicateResponse;
  const shouldSendVerificationEmail = sendOnSignUp ?? requireVerifiedEmail;
  const shouldSendVerificationEmailOnSignIn = sendOnSignIn;
  const revokeSessionsOnPasswordReset = config.revokeSessionsOnPasswordReset ?? false;

  async function createSessionAndRefreshToken(
    ctx: GenericActionCtx<DataModel>,
    args: {
      userId: string;
      identityId: string;
      rememberMe: boolean | undefined;
    },
  ): Promise<{ sessionId: string; token: string; refreshToken: string }> {
    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const refreshToken = generateVerificationToken();
    const refreshTokenHash = hashToken(refreshToken);
    const effectiveSessionTtlMs = resolveSessionTtlMs(args.rememberMe, sessionTtlMs);
    const expiresAt = now + effectiveSessionTtlMs;
    const token = await mintToken(
      args.userId,
      sessionId,
      { identityId: args.identityId },
      { expiresInSeconds: Math.floor(effectiveSessionTtlMs / 1000) },
    );

    await ctx.runMutation(component.native.sessions.createSessionAndRefreshToken, {
      sessionId,
      userId: args.userId,
      token,
      sessionExpiresAt: expiresAt,
      refreshTokenHash,
      refreshTokenExpiresAt: now + refreshTokenTtlMs,
    });

    return { sessionId, token, refreshToken };
  }

  const signUp = action({
    args: {
      email: v.string(),
      password: v.string(),
      name: v.string(),
      image: v.optional(v.string()),
      callbackURL: v.optional(v.string()),
      rememberMe: v.optional(v.boolean()),
    },
    returns: nativeAuthSessionValidator,
    handler: async (ctx, args) => {
      if (!enabled) {
        throw new Error("Email and password authentication is disabled");
      }
      if (disableSignUp) {
        throw new Error("Sign up is disabled");
      }

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

      // Hash the password before the transaction so both the success and
      // duplicate paths perform the same slow work, mitigating timing attacks.
      const credentialHash = await hashPassword(args.password);

      const subject = crypto.randomUUID();
      const account = { credentialHash };

      let verificationToken: string | undefined;
      let verificationCode: { tokenHash: string; expiresAt: number } | undefined;
      if (shouldSendVerificationEmail) {
        verificationToken = generateVerificationToken();
        const tokenHash = hashToken(verificationToken);
        verificationCode = {
          tokenHash,
          expiresAt: now + verificationCodeTtlMs,
        };
      }

      let initialSession:
        | {
            sessionId: string;
            sessionExpiresAt: number;
            refreshTokenHash: string;
            refreshTokenExpiresAt: number;
          }
        | undefined;
      let refreshToken: string | undefined;
      if (!shouldSkipAutoSignIn) {
        const sessionId = crypto.randomUUID();
        const effectiveSessionTtlMs = resolveSessionTtlMs(args.rememberMe, sessionTtlMs);
        refreshToken = generateVerificationToken();
        const refreshTokenHash = hashToken(refreshToken);
        initialSession = {
          sessionId,
          sessionExpiresAt: now + effectiveSessionTtlMs,
          refreshTokenHash,
          refreshTokenExpiresAt: now + refreshTokenTtlMs,
        };
      }

      const result = await ctx.runMutation(component.identity.provisionFromIdentity, {
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
          image: args.image,
          emailVerified: false,
        },
        account,
        verificationCode,
        initialSession,
        allowLink: false,
      });

      if (result.duplicate) {
        if (result.user && onExistingUserSignUp) {
          await onExistingUserSignUp({ user: toNativeAuthUser(result.user) });
        }
        if (shouldReturnGenericDuplicateResponse) {
          return buildGenericDuplicateResponse(normalizedEmail, args.name, args.image, now);
        }
        throw new Error("User already exists");
      }

      if (!result.user || !result.identityId) {
        throw new Error("Failed to create user");
      }

      if (shouldSendVerificationEmail && verificationToken) {
        await sendVerificationEmail(ctx, {
          user: result.user,
          token: verificationToken,
          type: "email_verification",
          urlBuilder: (token) => {
            if (args.callbackURL) {
              const appOrigin = emailConfig.appOrigin?.trim() ?? "";
              if (!appOrigin) {
                return null;
              }
              const callback = args.callbackURL.startsWith("http")
                ? args.callbackURL
                : `${trimTrailingSlash(appOrigin)}${args.callbackURL}`;
              return `${trimTrailingSlash(appOrigin)}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callback)}`;
            }
            return buildEmailVerificationUrl({
              token,
              appOrigin: emailConfig.appOrigin,
              verifyPath: emailConfig.verifyPath,
            });
          },
          draftBuilder: async (params) =>
            createEmailVerificationEmailDraft({
              from: params.from,
              to: params.to,
              verifyUrl: params.url,
              expiresAt: params.expiresAt,
            }),
          expiresAt: verificationCode!.expiresAt,
        });
      }

      if (shouldSkipAutoSignIn) {
        return { token: null, user: toNativeAuthUser(result.user) };
      }

      if (!result.sessionId || !result.token || !refreshToken) {
        throw new Error("Failed to create session");
      }

      return {
        token: result.token,
        refreshToken,
        user: toNativeAuthUser(result.user),
        userId: result.userId,
        identityId: result.identityId,
        sessionId: result.sessionId,
      };
    },
  });

  const signIn = action({
    args: {
      email: v.string(),
      password: v.string(),
      callbackURL: v.optional(v.string()),
      rememberMe: v.optional(v.boolean()),
    },
    returns: nativeAuthSessionValidator,
    handler: async (ctx, args) => {
      if (!enabled) {
        throw new Error("Email and password authentication is disabled");
      }

      const normalizedEmail = args.email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Invalid email");
      }

      const auth = await ctx.runQuery(component.identity.getUserAndAccount, {
        email: normalizedEmail,
      });
      if (!auth) {
        await hashPassword(args.password);
        throw new Error("Invalid email or password");
      }
      const { user, identity, account } = auth;

      if (!account || !(await verifyPasswordHash(args.password, account.credentialHash))) {
        await hashPassword(args.password);
        throw new Error("Invalid email or password");
      }

      if (requireVerifiedEmail && !user.emailVerified) {
        if (shouldSendVerificationEmailOnSignIn) {
          await queueVerificationEmail(ctx, {
            email: normalizedEmail,
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
        }
        throw new Error("Email not verified");
      }

      const { sessionId, token, refreshToken } = await createSessionAndRefreshToken(ctx, {
        userId: user._id,
        identityId: identity._id,
        rememberMe: args.rememberMe,
      });

      return {
        token,
        refreshToken,
        user: toNativeAuthUser(user),
        userId: user._id,
        identityId: identity._id,
        sessionId,
        redirect: !!args.callbackURL,
        url: args.callbackURL,
      };
    },
  });

  const signOut = action({
    args: {
      token: v.string(),
      callbackURL: v.optional(v.string()),
    },
    returns: v.object({
      success: v.boolean(),
      redirect: v.optional(v.boolean()),
      url: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      const payload = await verifyToken(args.token);
      const sessionId = payload.sessionId;
      if (typeof sessionId !== "string") {
        throw new Error("Invalid session token");
      }
      await ctx.runMutation(component.native.sessions.revokeSession, {
        sessionId,
      });
      await ctx.runMutation(component.native.refreshTokens.revokeRefreshTokensForSession, {
        sessionId,
      });
      return {
        success: true,
        redirect: !!args.callbackURL,
        url: args.callbackURL,
      };
    },
  });

  const updateSession = action({
    args: { refreshToken: v.string() },
    returns: nativeAuthSessionValidator,
    handler: async (ctx, args) => {
      return await handleUpdateSession(ctx, component, args.refreshToken);
    },
  });

  async function sendVerificationEmail(
    ctx: GenericActionCtx<DataModel>,
    args: {
      user: { _id: string; email?: string };
      token: string;
      type: VerificationCodeType;
      urlBuilder: (token: string) => string | null;
      draftBuilder: (params: {
        from: string;
        to: string;
        url: string | null;
        expiresAt: number;
      }) => Promise<EmailDraft | { status: "not_configured"; reason: string }>;
      expiresAt: number;
      fallbackEmail?: string;
    },
  ): Promise<EmailSendResult> {
    const emailConfig = resolveEmailConfig(config);

    if (!emailConfig.from || !emailConfig.sendEmail) {
      return { status: "not_configured", reason: "missing_email_config" };
    }

    const url = args.urlBuilder(args.token);
    const draft = await args.draftBuilder({
      from: emailConfig.from,
      to: args.user.email ?? args.fallbackEmail ?? "",
      url,
      expiresAt: args.expiresAt,
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

    return sendVerificationEmail(ctx, {
      user,
      token,
      type: args.type,
      urlBuilder: args.urlBuilder,
      draftBuilder: args.draftBuilder,
      expiresAt,
      fallbackEmail: args.email,
    });
  }

  const sendEmailVerification = action({
    args: {
      email: v.string(),
      callbackURL: v.optional(v.string()),
    },
    returns: v.object({
      status: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
      reason: v.optional(v.string()),
      emailId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      return queueVerificationEmail(ctx, {
        email: args.email,
        type: "email_verification",
        urlBuilder: (token) => {
          if (args.callbackURL) {
            const appOrigin = emailConfig.appOrigin?.trim() ?? "";
            if (!appOrigin) {
              return null;
            }
            const callback = args.callbackURL.startsWith("http")
              ? args.callbackURL
              : `${trimTrailingSlash(appOrigin)}${args.callbackURL}`;
            return `${trimTrailingSlash(appOrigin)}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(callback)}`;
          }
          return buildEmailVerificationUrl({
            token,
            appOrigin: emailConfig.appOrigin,
            verifyPath: emailConfig.verifyPath,
          });
        },
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
      const result = await ctx.runMutation(component.identity.verifyEmail, {
        tokenHash,
        provider: "password",
        issuer: "native",
      });
      if (!result.success) {
        return { success: false, reason: result.reason ?? "invalid" };
      }
      return { success: true };
    },
  });

  const sendPasswordReset = action({
    args: {
      email: v.string(),
      redirectTo: v.optional(v.string()),
    },
    returns: v.object({
      status: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
      reason: v.optional(v.string()),
      emailId: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      return queueVerificationEmail(ctx, {
        email: args.email,
        type: "password_reset",
        urlBuilder: (token) => {
          if (args.redirectTo) {
            const appOrigin = emailConfig.appOrigin?.trim() ?? "";
            if (!appOrigin) {
              return null;
            }
            const callbackURL = args.redirectTo.startsWith("http")
              ? args.redirectTo
              : `${trimTrailingSlash(appOrigin)}${args.redirectTo}`;
            return `${trimTrailingSlash(appOrigin)}/api/auth/reset-password/${encodeURIComponent(token)}?callbackURL=${encodeURIComponent(callbackURL)}`;
          }
          return buildPasswordResetUrl({
            token,
            appOrigin: emailConfig.appOrigin,
            resetPath: emailConfig.resetPath,
          });
        },
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
      status: v.boolean(),
      reason: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
      const passwordValidation = validatePassword(
        args.newPassword,
        minPasswordLength,
        maxPasswordLength,
      );
      if (!passwordValidation.valid) {
        return {
          status: false,
          reason:
            passwordValidation.reason === "too_short" ? "password_too_short" : "password_too_long",
        };
      }

      const tokenHash = hashToken(args.token);
      const credentialHash = await hashPassword(args.newPassword);

      const result = await ctx.runMutation(component.identity.resetPassword, {
        tokenHash,
        credentialHash,
        provider: "password",
        issuer: "native",
        revokeSessions: revokeSessionsOnPasswordReset,
      });

      if (!result.status) {
        return { status: false, reason: result.reason ?? "invalid" };
      }

      if (config.onPasswordReset && result.user) {
        await config.onPasswordReset({ user: toNativeAuthUser(result.user) });
      }

      return { status: true };
    },
  });

  const verifyPassword = action({
    args: {
      token: v.string(),
      password: v.string(),
    },
    returns: v.object({ success: v.boolean() }),
    handler: async (ctx, args) => {
      const payload = await verifyToken(args.token);
      const userId = payload.sub;
      const sessionId = payload.sessionId;
      if (typeof userId !== "string" || typeof sessionId !== "string") {
        return { success: false };
      }

      const session = await ctx.runQuery(component.native.sessions.getSessionByToken, {
        token: args.token,
      });
      if (!session || session.sessionId !== sessionId || (session.expiresAt ?? 0) < Date.now()) {
        return { success: false };
      }

      const identity = await ctx.runQuery(component.native.identities.getNativeIdentityByUser, {
        userId,
        provider: "password",
        issuer: "native",
      });
      if (!identity) {
        return { success: false };
      }

      const account = await ctx.runQuery(component.native.accounts.getAccountBySubject, {
        provider: "password",
        issuer: "native",
        subject: identity.subject,
      });
      if (!account) {
        return { success: false };
      }

      const valid = await verifyPasswordHash(args.password, account.credentialHash);
      return { success: valid };
    },
  });

  return {
    signUp,
    signIn,
    signOut,
    updateSession,
    sendEmailVerification,
    verifyEmail,
    sendPasswordReset,
    resetPassword,
    verifyPassword,
  };
}
