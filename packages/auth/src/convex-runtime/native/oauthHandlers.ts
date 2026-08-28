import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { createGitHubProvider, createGoogleProvider, type NativeOAuthProvider } from "./oauth.js";
import type { GitHubProviderConfig, GoogleProviderConfig } from "./oauth.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  mintOAuthState,
  verifyOAuthState,
} from "./oauthState.js";
import { mintToken } from "./jwt.js";
import type { NativeOAuthComponentHandle } from "./types.js";

export type NativeOAuthConfig = {
  github?: GitHubProviderConfig;
  google?: GoogleProviderConfig;
  /** Full callback URL registered with the OAuth provider. */
  redirectURI?: string;
  /** @default 7 days */
  sessionTtlMs?: number;
};

export type NativeOAuthSignInArgs = {
  provider: string;
  callbackURL?: string;
  errorURL?: string;
  newUserURL?: string;
};

export type NativeOAuthCallbackArgs = {
  provider: string;
  code: string;
  state: string;
};

export type NativeOAuthCallbackResult = {
  token: string;
  userId: string;
  identityId: string;
  sessionId: string;
  redirectUrl: string;
  createdUser: boolean;
};

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getProvider(config: NativeOAuthConfig, providerId: string): NativeOAuthProvider {
  if (providerId === "github" && config.github) {
    return createGitHubProvider(config.github);
  }
  if (providerId === "google" && config.google) {
    return createGoogleProvider(config.google);
  }
  throw new Error(`Unsupported OAuth provider: ${providerId}`);
}

export function getRedirectURI(config: NativeOAuthConfig, provider: NativeOAuthProvider): string {
  if (config.redirectURI) return config.redirectURI;
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new Error("Missing OAuth redirect URI: set CONVEX_SITE_URL or pass redirectURI");
  }
  return `${siteUrl.replace(/\/$/, "")}/api/auth/callback/${provider.id}`;
}

export async function handleSignIn(
  config: NativeOAuthConfig,
  args: NativeOAuthSignInArgs,
): Promise<{ url: string }> {
  const provider = getProvider(config, args.provider);
  const redirectURI = getRedirectURI(config, provider);
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = await mintOAuthState({
    provider: provider.id,
    codeVerifier,
    callbackURL: args.callbackURL,
    errorURL: args.errorURL,
    newUserURL: args.newUserURL,
  });
  const url = provider.createAuthorizationURL({
    state,
    codeChallenge,
    redirectURI,
  });
  return { url: url.toString() };
}

export async function handleCallback<DataModel extends GenericDataModel>(
  ctx: GenericActionCtx<DataModel>,
  component: NativeOAuthComponentHandle,
  config: NativeOAuthConfig,
  args: NativeOAuthCallbackArgs,
): Promise<NativeOAuthCallbackResult> {
  const statePayload = await verifyOAuthState(args.state);
  if (statePayload.provider !== args.provider) {
    throw new Error("OAuth provider mismatch");
  }

  const provider = getProvider(config, args.provider);
  const redirectURI = getRedirectURI(config, provider);

  const tokens = await provider.exchangeAuthorizationCode({
    code: args.code,
    codeVerifier: statePayload.codeVerifier,
    redirectURI,
  });

  const { user } = await provider.getUserInfo({ accessToken: tokens.accessToken });
  if (!user.id) {
    throw new Error("OAuth provider did not return a user id");
  }

  const identityResult = await ctx.runMutation(component.identity.provisionFromIdentity, {
    identity: {
      identityId: `${provider.issuer}:${user.id}`,
      provider: provider.id,
      issuer: provider.issuer,
      subject: user.id,
      tokenIdentifier: `${provider.issuer}:${user.id}`,
      email: user.email,
      emailVerified: user.emailVerified,
      sessionId: null,
    },
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerified: user.emailVerified,
    },
  });

  const existingAccount = await ctx.runQuery(component.native.accounts.getAccountBySubject, {
    provider: provider.id,
    issuer: provider.issuer,
    subject: user.id,
  });
  if (!existingAccount) {
    await ctx.runMutation(component.native.accounts.createAccount, {
      userId: identityResult.userId,
      provider: provider.id,
      issuer: provider.issuer,
      subject: user.id,
      credentialHash: "",
    });
  }

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const sessionTtlMs = config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const expiresAt = now + sessionTtlMs;
  const token = await mintToken(
    identityResult.userId,
    sessionId,
    { identityId: identityResult.identityId },
    { expiresInSeconds: Math.floor(sessionTtlMs / 1000) },
  );

  await ctx.runMutation(component.native.sessions.createSession, {
    sessionId,
    userId: identityResult.userId,
    token,
    expiresAt,
  });

  const redirectUrl =
    (identityResult.createdUser && statePayload.newUserURL) ||
    statePayload.callbackURL ||
    process.env.SITE_URL ||
    "/";

  return {
    token,
    userId: identityResult.userId,
    identityId: identityResult.identityId,
    sessionId,
    redirectUrl,
    createdUser: identityResult.createdUser,
  };
}
