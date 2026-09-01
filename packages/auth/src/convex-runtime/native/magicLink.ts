import { action } from "../../component/_generated/server.js";
import type { FunctionReference, GenericActionCtx } from "convex/server";
import type { DataModel } from "../../component/_generated/dataModel.js";
import { v } from "convex/values";
import { trimTrailingSlash } from "../account/emailShared.js";
import { generateVerificationToken, hashToken } from "./tokens.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

// Approximation of the `z.email()` check used by Better Auth.
const EMAIL_REGEX =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_+-]\.?)+[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

const MAGIC_LINK_TOKEN_TTL_MS = 5 * 60 * 1000;

export type MagicLinkSender = (data: {
  email: string;
  url: string;
  token: string;
  metadata?: Record<string, string>;
}) => Promise<string>;

export type NativeMagicLinkConfig = {
  enabled?: boolean;
  appOrigin?: string;
  sendMagicLink: MagicLinkSender;
  expiresInMs?: number;
  disableSignUp?: boolean;
};

export type NativeMagicLinkActions = {
  signInMagicLink: ReturnType<typeof action>;
  verifyMagicLink?: ReturnType<typeof action>;
};

export type NativeMagicLinkFunctionReferences = {
  [K in keyof NativeMagicLinkActions]: FunctionReference<"action", "public">;
};

type SignInMagicLinkBody = {
  email: string;
  name?: string;
  callbackURL?: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
  metadata?: Record<string, string>;
};

function resolveMagicLinkBaseUrl(config: NativeMagicLinkConfig): string {
  const appOrigin = config.appOrigin?.trim() ?? process.env.CONVEX_SITE_URL ?? "";
  if (!appOrigin) {
    throw new Error("Magic link: missing appOrigin or CONVEX_SITE_URL");
  }
  return trimTrailingSlash(appOrigin);
}

function buildMagicLinkUrl(
  baseUrl: string,
  token: string,
  callbackURL: string,
  newUserCallbackURL: string | undefined,
  errorCallbackURL: string | undefined,
): string {
  const url = new URL("/magic-link/verify", baseUrl);
  url.searchParams.set("token", token);
  url.searchParams.set("callbackURL", callbackURL);
  if (newUserCallbackURL) {
    url.searchParams.set("newUserCallbackURL", newUserCallbackURL);
  }
  if (errorCallbackURL) {
    url.searchParams.set("errorCallbackURL", errorCallbackURL);
  }
  return url.toString();
}

export function nativeMagicLink(
  component: NativeEmailAndPasswordComponentHandle,
  config: NativeMagicLinkConfig,
): NativeMagicLinkActions {
  const enabled = config.enabled ?? true;
  const expiresInMs = config.expiresInMs ?? MAGIC_LINK_TOKEN_TTL_MS;

  const signInMagicLink = action({
    args: {
      email: v.string(),
      name: v.optional(v.string()),
      callbackURL: v.optional(v.string()),
      newUserCallbackURL: v.optional(v.string()),
      errorCallbackURL: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.string())),
    },
    returns: v.object({ status: v.boolean() }),
    handler: async (
      ctx: GenericActionCtx<DataModel>,
      args: SignInMagicLinkBody,
    ) => {
      if (!enabled) {
        throw new Error("Magic link authentication is disabled");
      }

      const normalizedEmail = args.email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("Invalid email");
      }

      const token = generateVerificationToken();
      const tokenHash = await hashToken(token);
      const now = Date.now();
      const expiresAt = now + expiresInMs;

      const metadata = JSON.stringify({
        email: normalizedEmail,
        name: args.name,
      });

      await ctx.runMutation(component.native.verifiers.createVerifier, {
        verifierId: tokenHash,
        type: "magic-link",
        metadata,
        expiresAt,
      });

      const baseUrl = resolveMagicLinkBaseUrl(config);
      const callbackURL = args.callbackURL ?? "/";
      const url = buildMagicLinkUrl(
        baseUrl,
        token,
        callbackURL,
        args.newUserCallbackURL,
        args.errorCallbackURL,
      );

      await config.sendMagicLink({
        email: normalizedEmail,
        url,
        token,
        metadata: args.metadata,
      });

      return { status: true };
    },
  });

  return { signInMagicLink };
}
