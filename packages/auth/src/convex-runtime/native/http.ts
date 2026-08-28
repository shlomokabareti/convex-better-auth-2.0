import { httpActionGeneric, type HttpRouter, type FunctionReference } from "convex/server";
import { v } from "convex/values";
import { getJwks } from "./jwt.js";
import { parse } from "../helpers/index.js";
import { hashToken, isTokenExpired } from "./tokens.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";
import type { NativeAuthSession } from "./provider.js";

function buildErrorRedirect(callbackURL: string, error: string): Response {
  const redirect = new URL(
    callbackURL,
    callbackURL.startsWith("http") ? undefined : "http://localhost",
  );
  redirect.searchParams.set("error", error);
  return new Response(null, {
    status: 302,
    headers: { Location: redirect.toString() },
  });
}

function buildTokenRedirect(callbackURL: string, token: string): Response {
  const redirect = new URL(
    callbackURL,
    callbackURL.startsWith("http") ? undefined : "http://localhost",
  );
  redirect.searchParams.set("token", token);
  return new Response(null, {
    status: 302,
    headers: { Location: redirect.toString() },
  });
}

export function addNativeAuthHttpRoutes(
  http: HttpRouter,
  component?: NativeEmailAndPasswordComponentHandle,
  actions?: {
    updateSession: FunctionReference<"action", "public", { refreshToken: string }, NativeAuthSession>;
  },
): void {
  http.route({
    path: "/.well-known/jwks.json",
    method: "GET",
    handler: httpActionGeneric(async () => {
      return new Response(JSON.stringify(getJwks()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  if (!component) {
    return;
  }

  http.route({
    path: "/api/auth/reset-password/:token",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const token = url.pathname.split("/").pop() ?? "";
      const callbackURL = url.searchParams.get("callbackURL");

      if (!callbackURL) {
        return new Response("Missing callbackURL", { status: 400 });
      }

      const tokenHash = hashToken(token);
      const code = await ctx.runQuery(component.native.codes.getVerificationCodeByTokenHash, {
        tokenHash,
        type: "password_reset",
      });

      if (!code || isTokenExpired(code.expiresAt)) {
        return buildErrorRedirect(callbackURL, "INVALID_TOKEN");
      }

      return buildTokenRedirect(callbackURL, token);
    }),
  });

  http.route({
    path: "/api/auth/verify-email",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const token = url.searchParams.get("token") ?? "";
      const callbackURL = url.searchParams.get("callbackURL");

      const tokenHash = hashToken(token);
      const result = await ctx.runMutation(component.identity.verifyEmail, {
        tokenHash,
        provider: "password",
        issuer: "native",
      });

      if (!result.success) {
        if (callbackURL) {
          return buildErrorRedirect(callbackURL, result.reason === "expired" ? "EXPIRED_TOKEN" : "INVALID_TOKEN");
        }
        return new Response(JSON.stringify({ success: false, reason: result.reason ?? "invalid" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (callbackURL) {
        return buildTokenRedirect(callbackURL, token);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  http.route({
    path: "/api/auth/update-session",
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      if (!actions?.updateSession) {
        return new Response(JSON.stringify({ success: false, reason: "not_configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await request.json().catch(() => undefined);

      let parsed: { refreshToken: string };
      try {
        parsed = parse(v.object({ refreshToken: v.string() }), body);
      } catch {
        return new Response(JSON.stringify({ success: false, reason: "missing_refresh_token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await ctx.runAction(actions.updateSession, {
        refreshToken: parsed.refreshToken,
      });

      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}
