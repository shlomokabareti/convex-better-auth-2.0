import { action } from "../../component/_generated/server.js";
import type { FunctionReference, GenericActionCtx } from "convex/server";
import type { DataModel } from "../../component/_generated/dataModel.js";
import { v } from "convex/values";
import { generateEmailOtp, hashToken } from "./tokens.js";
import { nativeAuthSessionValidator } from "./provider.js";
import { toNativeAuthUser, type NativeEmailAndPasswordComponentHandle } from "./types.js";

// Approximation of the `z.email()` check used by Better Auth.
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_+-]\.?)+[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type NativeAuthSendResult =
  | { status: "queued"; emailId: string }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string };

export type EmailOtpSender = (data: {
  email: string;
  otp: string;
  type: string;
}) => Promise<string>;

export type NativeEmailOtpConfig = {
  enabled?: boolean;
  sendVerificationOTP: EmailOtpSender;
  expiresInMs?: number;
  disableSignUp?: boolean;
  sessionTtlMs?: number;
  refreshTokenTtlMs?: number;
};

export type NativeEmailOtpActions = {
  signInEmailOtp: ReturnType<typeof action>;
  verifyEmailOtp: ReturnType<typeof action>;
};

export type NativeEmailOtpFunctionReferences = {
  [K in keyof NativeEmailOtpActions]: FunctionReference<"action", "public">;
};

type SignInEmailOtpBody = {
  email: string;
  type?: string;
  name?: string;
};

type VerifyEmailOtpBody = {
  email: string;
  otp: string;
  type?: string;
};

export function nativeEmailOtp(
  component: NativeEmailAndPasswordComponentHandle,
  config: NativeEmailOtpConfig,
): NativeEmailOtpActions {
  const enabled = config.enabled ?? true;
  const expiresInMs = config.expiresInMs ?? EMAIL_OTP_TTL_MS;
  const disableSignUp = config.disableSignUp ?? false;
  const sessionTtlMs = config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const refreshTokenTtlMs = config.refreshTokenTtlMs ?? DEFAULT_REFRESH_TOKEN_TTL_MS;

  const signInEmailOtp = action({
    args: {
      email: v.string(),
      type: v.optional(v.string()),
      name: v.optional(v.string()),
    },
    returns: v.object({
      status: v.union(v.literal("queued"), v.literal("not_configured"), v.literal("failed")),
      reason: v.optional(v.string()),
      emailId: v.optional(v.string()),
    }),
    handler: async (ctx: GenericActionCtx<DataModel>, args: SignInEmailOtpBody) => {
      if (!enabled) {
        throw new Error("Email OTP authentication is disabled");
      }

      const normalizedEmail = args.email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Invalid email");
      }

      const otp = generateEmailOtp();
      const otpHash = await hashToken(otp);
      const now = Date.now();
      const expiresAt = now + expiresInMs;

      const metadata = JSON.stringify({
        email: normalizedEmail,
        name: args.name,
      });

      await ctx.runMutation(component.native.verifiers.createVerifier, {
        verifierId: otpHash,
        type: "email-otp",
        metadata,
        expiresAt,
      });

      const emailId = await config.sendVerificationOTP({
        email: normalizedEmail,
        otp,
        type: args.type ?? "sign-in",
      });

      return { status: "queued" as const, emailId };
    },
  });

  const verifyEmailOtp = action({
    args: {
      email: v.string(),
      otp: v.string(),
      type: v.optional(v.string()),
    },
    returns: nativeAuthSessionValidator,
    handler: async (ctx: GenericActionCtx<DataModel>, args: VerifyEmailOtpBody) => {
      if (!enabled) {
        throw new Error("Email OTP authentication is disabled");
      }

      const normalizedEmail = args.email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Invalid email");
      }

      const otpHash = await hashToken(args.otp);
      const verifier = await ctx.runMutation(component.native.verifiers.consumeVerifier, {
        verifierId: otpHash,
      });
      if (!verifier) {
        throw new Error("INVALID_OTP");
      }

      let metadata: { email?: string; name?: string };
      try {
        metadata = verifier.metadata ? JSON.parse(verifier.metadata) : {};
      } catch {
        throw new Error("INVALID_OTP");
      }

      const email = metadata.email?.trim().toLowerCase();
      if (!email || email !== normalizedEmail) {
        throw new Error("INVALID_OTP");
      }

      const existingUser = await ctx.runQuery(component.native.users.getUserByEmail, { email });
      if (!existingUser && disableSignUp) {
        throw new Error("SIGN_UP_DISABLED");
      }

      const now = Date.now();
      const sessionId = crypto.randomUUID();
      const refreshToken = generateEmailOtp();
      const refreshTokenHash = await hashToken(refreshToken);

      const result = await ctx.runMutation(component.identity.provisionFromIdentity, {
        identity: {
          identityId: `email-otp:native:${email}`,
          provider: "emailOtp",
          issuer: "native",
          subject: email,
          tokenIdentifier: email,
          email,
          emailVerified: true,
        },
        user: {
          email,
          name: metadata.name,
          emailVerified: true,
        },
        allowLink: true,
        initialSession: {
          sessionId,
          sessionExpiresAt: now + sessionTtlMs,
          refreshTokenHash,
          refreshTokenExpiresAt: now + refreshTokenTtlMs,
        },
      });

      if (!result.user) {
        throw new Error("INVALID_OTP");
      }

      return {
        token: result.token ?? null,
        refreshToken,
        sessionId: result.sessionId ?? sessionId,
        user: toNativeAuthUser(result.user),
        userId: result.userId,
        identityId: result.identityId,
      };
    },
  });

  return { signInEmailOtp, verifyEmailOtp };
}
