import { httpActionGeneric, type HttpRouter } from "convex/server";
import { handleCallback, handleSignIn, type NativeOAuthConfig } from "./oauthHandlers.js";
import { verifyOAuthState } from "./oauthState.js";
import type { NativeOAuthComponentHandle } from "./types.js";

function setCookieHeader(token: string, maxAgeMs?: number, secure?: boolean): string {
  let header = `convex-auth-token=${token}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAgeMs !== undefined) {
    header += `; Max-Age=${Math.floor(maxAgeMs / 1000)}`;
  }
  if (secure) {
    header += "; Secure";
  }
  return header;
}

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
    headers: { Location: redirect.pathname + redirect.search },
  });
}

export type NativeOAuthHttpConfig = {
  component: NativeOAuthComponentHandle;
  oauth: NativeOAuthConfig;
};

export function addNativeOAuthHttpRoutes(http: HttpRouter, config: NativeOAuthHttpConfig): void {
  http.route({
    path: "/api/auth/signin/:provider",
    method: "GET",
    handler: httpActionGeneric(async (_ctx, request) => {
      const url = new URL(request.url);
      const provider = parseProvider(url);
      const callbackURL =
        url.searchParams.get("redirectTo") ?? url.searchParams.get("callbackURL") ?? undefined;
      const errorURL = url.searchParams.get("errorURL") ?? undefined;
      const newUserURL = url.searchParams.get("newUserURL") ?? undefined;
      const requestSignUp = url.searchParams.get("requestSignUp") === "true";
      const link = url.searchParams.get("link") === "true";

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
    path: "/api/auth/callback/:provider",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const provider = parseProvider(url);
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
        return buildErrorRedirect(base, error, errorDescription ?? undefined);
      }

      if (!code || !state) {
        const base = process.env.SITE_URL ?? "/";
        return buildErrorRedirect(base, "no_code", "Missing code or state");
      }

      const result = await handleCallback(ctx, config.component, config.oauth, {
        provider,
        code,
        state,
      });
      if ("error" in result) {
        return buildErrorRedirect(result.redirectUrl, result.error, result.errorDescription);
      }

      const headers = new Headers();
      headers.set("Location", result.redirectUrl);
      headers.set(
        "Set-Cookie",
        setCookieHeader(
          result.token,
          config.oauth.sessionTtlMs,
          process.env.NODE_ENV === "production",
        ),
      );
      return new Response(null, { status: 302, headers });
    }),
  });
}
