import { httpActionGeneric, type HttpRouter } from "convex/server";
import { handleCallback, handleSignIn, type NativeOAuthConfig } from "./oauthHandlers.js";
import { verifyOAuthState } from "./oauthState.js";
import type { NativeOAuthComponentHandle } from "./types.js";
import { verifyToken } from "./jwt.js";
import { isAllowedRedirectUrl } from "./callback.js";
import { setCookieHeader, readCookie } from "./cookies.js";

const ACCESS_TOKEN_COOKIE = "convex-auth-token";
const REFRESH_TOKEN_COOKIE = "convex-auth-refresh-token";
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function parseProvider(url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function buildErrorRedirect(base: string, error: string, description?: string): Response {
  const redirect = new URL(base, base.startsWith("http") ? undefined : "http://localhost");
  redirect.searchParams.set("error", error);
  if (description) redirect.searchParams.set("error_description", description);
  return new Response(null, {
    status: 302,
    headers: { Location: redirect.toString() },
  });
}

export type NativeOAuthHttpConfig = {
  component: NativeOAuthComponentHandle;
  oauth: NativeOAuthConfig;
  trustedOrigins?: string[];
};

function getTrustedOrigins(config: NativeOAuthHttpConfig, requestOrigin: string): string[] {
  return [
    requestOrigin,
    ...(config.oauth.trustedOrigins ?? []),
    ...(process.env.SITE_URL ? [process.env.SITE_URL] : []),
    ...(process.env.CONVEX_SITE_URL ? [process.env.CONVEX_SITE_URL] : []),
  ];
}

export function addNativeOAuthHttpRoutes(http: HttpRouter, config: NativeOAuthHttpConfig): void {
  http.route({
    pathPrefix: "/api/auth/signin/",
    method: "GET",
    handler: httpActionGeneric(async (_ctx, request) => {
      const url = new URL(request.url);
      const requestOrigin = url.origin;
      const trustedOrigins = getTrustedOrigins(config, requestOrigin);
      const provider = parseProvider(url);
      if (!provider) {
        return buildErrorRedirect(
          process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "/",
          "invalid_callback_request",
          "Missing provider",
        );
      }
      const callbackURL =
        url.searchParams.get("redirectTo") ?? url.searchParams.get("callbackURL") ?? undefined;
      const errorURL = url.searchParams.get("errorURL") ?? undefined;
      const newUserURL = url.searchParams.get("newUserURL") ?? undefined;
      const requestSignUp = url.searchParams.get("requestSignUp") === "true";
      const link = url.searchParams.get("link") === "true";

      if (callbackURL && !isAllowedRedirectUrl(callbackURL, requestOrigin, trustedOrigins)) {
        return buildErrorRedirect(
          process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "/",
          "invalid_callback_url",
        );
      }
      if (errorURL && !isAllowedRedirectUrl(errorURL, requestOrigin, trustedOrigins)) {
        return buildErrorRedirect(
          process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "/",
          "invalid_error_url",
        );
      }
      if (newUserURL && !isAllowedRedirectUrl(newUserURL, requestOrigin, trustedOrigins)) {
        return buildErrorRedirect(
          process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "/",
          "invalid_new_user_url",
        );
      }

      const result = await handleSignIn(config.oauth, {
        provider,
        callbackURL,
        errorURL,
        newUserURL,
        requestSignUp,
        link,
      });

      return new Response(null, {
        status: 302,
        headers: { Location: result.url },
      });
    }),
  });

  http.route({
    pathPrefix: "/api/auth/callback/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const provider = parseProvider(url);
      if (!provider) {
        return buildErrorRedirect(
          process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "/",
          "invalid_callback_request",
          "Missing provider",
        );
      }
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description") ?? undefined;
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        const errorURL = await (async () => {
          try {
            const statePayload = await verifyOAuthState(state ?? "");
            return statePayload.errorURL;
          } catch {
            return undefined;
          }
        })();
        const base = errorURL ?? process.env.SITE_URL ?? "/";
        return buildErrorRedirect(
          base,
          "provider_error",
          errorDescription ?? error,
        );
      }

      if (!state) {
        const base = process.env.SITE_URL ?? "/";
        return buildErrorRedirect(base, "invalid_callback_request", "Missing state");
      }

      if (!code) {
        const base = process.env.SITE_URL ?? "/";
        return buildErrorRedirect(base, "no_code", "Missing code");
      }

      let linkingUserId: string | undefined;
      const accessToken = readCookie(request, ACCESS_TOKEN_COOKIE);
      if (accessToken) {
        try {
          const payload = await verifyToken(accessToken);
          if (typeof payload.sub === "string") {
            linkingUserId = payload.sub;
          }
        } catch {
          // Invalid access token; treat as unauthenticated.
        }
      }

      const result = await handleCallback(ctx, config.component, config.oauth, {
        provider,
        code,
        state,
        linkingUserId,
      });
      if ("error" in result) {
        return buildErrorRedirect(result.redirectUrl, result.error, result.errorDescription);
      }

      const secure = new URL(request.url).protocol === "https:";
      const accessTokenMaxAge =
        config.oauth.sessionTtlMs !== undefined
          ? Math.floor(config.oauth.sessionTtlMs / 1000)
          : undefined;

      const headers = new Headers();
      headers.set("Location", result.redirectUrl);
      headers.append(
        "Set-Cookie",
        setCookieHeader(ACCESS_TOKEN_COOKIE, result.token, accessTokenMaxAge, secure),
      );
      headers.append(
        "Set-Cookie",
        setCookieHeader(
          REFRESH_TOKEN_COOKIE,
          result.refreshToken,
          REFRESH_TOKEN_MAX_AGE_SECONDS,
          secure,
        ),
      );
      return new Response(null, { status: 302, headers });
    }),
  });
}
