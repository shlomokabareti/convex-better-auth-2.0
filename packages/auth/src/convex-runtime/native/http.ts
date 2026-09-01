import { httpActionGeneric, type HttpRouter } from "convex/server";
import { v } from "convex/values";
import { base64urlToBytes } from "./password.js";
import { getJwks, verifyToken } from "./jwt.js";
import { parse } from "../helpers/index.js";
import { hashToken, isTokenExpired } from "./tokens.js";
import { handleUpdateSession } from "./updateSession.js";
import type { NativeEmailAndPasswordFunctionReferences } from "./provider.js";
import { toNativeAuthUser } from "./types.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

const ACCESS_TOKEN_COOKIE = "convex-auth-token";
const REFRESH_TOKEN_COOKIE = "convex-auth-refresh-token";
const TWO_FACTOR_PENDING_COOKIE = "convex-auth-two-factor";
const TWO_FACTOR_TRUSTED_DEVICE_COOKIE = "convex-auth-trusted-device";
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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

function base64UrlDecode(value: string): string {
  try {
    return new TextDecoder().decode(base64urlToBytes(value));
  } catch {
    return "";
  }
}

function getTokenExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const payload = parts[1];
  if (!payload) {
    return null;
  }
  try {
    const json = base64UrlDecode(payload);
    const parsed = JSON.parse(json) as { exp?: number };
    if (typeof parsed.exp !== "number") {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

function setCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds?: number,
  secure?: boolean,
): string {
  let cookie = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAgeSeconds !== undefined) {
    cookie += `; Max-Age=${maxAgeSeconds}`;
  }
  if (secure) {
    cookie += "; Secure";
  }
  return cookie;
}

function buildTwoFactorVerifyResponse(
  request: Request,
  session: { token: string | null; refreshToken?: string; trustDeviceToken?: string; trustDeviceMaxAgeMs?: number },
  trustDeviceToken?: string,
): Response {
  const secure = new URL(request.url).protocol === "https:";
  const headers = new Headers({ "Content-Type": "application/json" });

  if (session.token) {
    const expiry = getTokenExpiry(session.token);
    const maxAge = expiry ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : undefined;
    headers.append("Set-Cookie", setCookieHeader(ACCESS_TOKEN_COOKIE, session.token, maxAge, secure));
    headers.append("Set-Cookie", clearCookieHeader(TWO_FACTOR_PENDING_COOKIE, secure));
  }
  if (session.refreshToken) {
    headers.append("Set-Cookie", setCookieHeader(REFRESH_TOKEN_COOKIE, session.refreshToken, REFRESH_TOKEN_MAX_AGE_SECONDS, secure));
  }
  const trustedToken = trustDeviceToken ?? session.trustDeviceToken;
  if (trustedToken) {
    const maxAge = session.trustDeviceMaxAgeMs ? Math.floor(session.trustDeviceMaxAgeMs / 1000) : undefined;
    headers.append("Set-Cookie", setCookieHeader(TWO_FACTOR_TRUSTED_DEVICE_COOKIE, trustedToken, maxAge, secure));
  }

  const responseBody = { success: true, ...session } as Record<string, unknown>;
  if (responseBody.user && typeof responseBody.user === "object" && responseBody.user !== null) {
    // user is already a plain object from toNativeAuthUser
  }
  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers,
  });
}

function clearCookieHeader(name: string, secure?: boolean): string {
  let cookie = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (secure) {
    cookie += "; Secure";
  }
  return cookie;
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]+)`));
  return match?.[1];
}

function errorStatusAndReason(error: unknown): { status: number; reason: string } {
  const message = error instanceof Error ? error.message : "unknown";
  const map: Record<string, { status: number; reason: string }> = {
    "Email and password authentication is disabled": { status: 400, reason: "auth_disabled" },
    "Sign up is disabled": { status: 400, reason: "sign_up_disabled" },
    "Invalid email": { status: 400, reason: "invalid_email" },
    "Password is too short": { status: 400, reason: "password_too_short" },
    "Password is too long": { status: 400, reason: "password_too_long" },
    "User already exists": { status: 400, reason: "user_already_exists" },
    "Invalid email or password": { status: 401, reason: "invalid_email_or_password" },
    "Email not verified": { status: 401, reason: "email_not_verified" },
    "Failed to create session": { status: 500, reason: "session_creation_failed" },
    "Invalid session token": { status: 401, reason: "invalid_session" },
  };
  return map[message] ?? { status: 500, reason: "unknown" };
}

function buildErrorResponse(status: number, reason: string): Response {
  return new Response(JSON.stringify({ success: false, reason }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function addNativeAuthHttpRoutes(
  http: HttpRouter,
  component?: NativeEmailAndPasswordComponentHandle,
  actions?: NativeEmailAndPasswordFunctionReferences,
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

  http.route({
    path: "/.well-known/openid-configuration",
    method: "GET",
    handler: httpActionGeneric(async (_ctx, request) => {
      const origin = new URL(request.url).origin;
      const config = {
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/api/auth/signin`,
        token_endpoint: `${origin}/api/auth/token`,
        userinfo_endpoint: `${origin}/api/auth/userinfo`,
        jwks_uri: `${origin}/.well-known/jwks.json`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        scopes_supported: ["openid", "profile", "email"],
      };
      return new Response(JSON.stringify(config), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });

  if (actions) {
    http.route({
      path: "/api/auth/sign-up",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);

        let parsed: {
          email: string;
          password: string;
          name: string;
          image?: string;
          callbackURL?: string;
          rememberMe?: boolean;
        };
        try {
          parsed = parse(
            v.object({
              email: v.string(),
              password: v.string(),
              name: v.string(),
              image: v.optional(v.string()),
              callbackURL: v.optional(v.string()),
              rememberMe: v.optional(v.boolean()),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let session;
        try {
          session = await ctx.runAction(actions.signUp, parsed);
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }
        const secure = new URL(request.url).protocol === "https:";

        const headers = new Headers({ "Content-Type": "application/json" });
        if (session.token) {
          const expiry = getTokenExpiry(session.token);
          const maxAge = expiry ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : undefined;
          headers.append(
            "Set-Cookie",
            setCookieHeader(ACCESS_TOKEN_COOKIE, session.token, maxAge, secure),
          );
        }
        if (session.refreshToken) {
          const maxAge = parsed.rememberMe ? REFRESH_TOKEN_MAX_AGE_SECONDS : undefined;
          headers.append(
            "Set-Cookie",
            setCookieHeader(REFRESH_TOKEN_COOKIE, session.refreshToken, maxAge, secure),
          );
        }

        return new Response(JSON.stringify(session), { status: 200, headers });
      }),
    });

    http.route({
      path: "/api/auth/sign-in",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);

        let parsed: {
          email: string;
          password: string;
          callbackURL?: string;
          rememberMe?: boolean;
          trustedDeviceToken?: string;
        };
        try {
          parsed = parse(
            v.object({
              email: v.string(),
              password: v.string(),
              callbackURL: v.optional(v.string()),
              rememberMe: v.optional(v.boolean()),
              trustedDeviceToken: v.optional(v.string()),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        parsed.trustedDeviceToken =
          parsed.trustedDeviceToken ?? readCookie(request, TWO_FACTOR_TRUSTED_DEVICE_COOKIE);

        let session;
        try {
          session = await ctx.runAction(actions.signIn, parsed);
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }
        const secure = new URL(request.url).protocol === "https:";

        const headers = new Headers({ "Content-Type": "application/json" });
        if (session.token) {
          const expiry = getTokenExpiry(session.token);
          const maxAge = expiry ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : undefined;
          headers.append(
            "Set-Cookie",
            setCookieHeader(ACCESS_TOKEN_COOKIE, session.token, maxAge, secure),
          );
          if (session.twoFactorChallengeToken) {
            headers.append(
              "Set-Cookie",
              clearCookieHeader(TWO_FACTOR_PENDING_COOKIE, secure),
            );
          }
        }
        if (session.refreshToken) {
          const maxAge = parsed.rememberMe ? REFRESH_TOKEN_MAX_AGE_SECONDS : undefined;
          headers.append(
            "Set-Cookie",
            setCookieHeader(REFRESH_TOKEN_COOKIE, session.refreshToken, maxAge, secure),
          );
        }
        if (session.twoFactorChallengeToken) {
          const maxAge = session.twoFactorCookieMaxAgeMs
            ? Math.floor(session.twoFactorCookieMaxAgeMs / 1000)
            : undefined;
          headers.append(
            "Set-Cookie",
            setCookieHeader(TWO_FACTOR_PENDING_COOKIE, session.twoFactorChallengeToken, maxAge, secure),
          );
        }

        if (session.url) {
          headers.append("Location", session.url);
        }

        return new Response(JSON.stringify(session), { status: 200, headers });
      }),
    });

    http.route({
      path: "/api/auth/sign-out",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);

        let parsed: { token?: string; callbackURL?: string };
        try {
          parsed = parse(
            v.object({
              token: v.optional(v.string()),
              callbackURL: v.optional(v.string()),
            }),
            body,
          );
        } catch {
          parsed = {};
        }

        const token = parsed.token ?? readCookie(request, ACCESS_TOKEN_COOKIE);
        let result;
        try {
          result = token
            ? await ctx.runAction(actions.signOut, { token, callbackURL: parsed.callbackURL })
            : { success: true, redirect: false as const };
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        const secure = new URL(request.url).protocol === "https:";
        const headers = new Headers({ "Content-Type": "application/json" });
        headers.append("Set-Cookie", clearCookieHeader(ACCESS_TOKEN_COOKIE, secure));
        headers.append("Set-Cookie", clearCookieHeader(REFRESH_TOKEN_COOKIE, secure));

        if (result.url) {
          headers.append("Location", result.url);
          return new Response(JSON.stringify(result), { status: 302, headers });
        }

        return new Response(JSON.stringify(result), { status: 200, headers });
      }),
    });

    http.route({
      path: "/api/auth/two-factor/enable",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);
        let parsed: { password: string; issuer?: string };
        try {
          parsed = parse(
            v.object({
              password: v.string(),
              issuer: v.optional(v.string()),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = readCookie(request, ACCESS_TOKEN_COOKIE);
        if (!token) {
          return new Response(JSON.stringify({ success: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let result;
        try {
          result = await ctx.runAction(actions.twoFactorEnable, {
            token,
            password: parsed.password,
            issuer: parsed.issuer,
          });
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        if (result.error) {
          return buildErrorResponse(401, result.error);
        }

        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });

    http.route({
      path: "/api/auth/two-factor/verify-totp",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);
        let parsed: { code: string; trustDevice?: boolean };
        try {
          parsed = parse(
            v.object({
              code: v.string(),
              trustDevice: v.optional(v.boolean()),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token =
          readCookie(request, TWO_FACTOR_PENDING_COOKIE) ??
          readCookie(request, ACCESS_TOKEN_COOKIE);
        if (!token) {
          return new Response(JSON.stringify({ success: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let session;
        try {
          session = await ctx.runAction(actions.twoFactorVerifyTOTP, {
            token,
            code: parsed.code,
            trustDevice: parsed.trustDevice,
          });
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        return buildTwoFactorVerifyResponse(request, session, session.trustDeviceToken);
      }),
    });

    http.route({
      path: "/api/auth/two-factor/verify-backup-code",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);
        let parsed: { code: string; trustDevice?: boolean };
        try {
          parsed = parse(
            v.object({
              code: v.string(),
              trustDevice: v.optional(v.boolean()),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = readCookie(request, TWO_FACTOR_PENDING_COOKIE);
        if (!token) {
          return new Response(JSON.stringify({ success: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let session;
        try {
          session = await ctx.runAction(actions.twoFactorVerifyBackupCode, {
            token,
            code: parsed.code,
            trustDevice: parsed.trustDevice,
          });
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        return buildTwoFactorVerifyResponse(request, session, session.trustDeviceToken);
      }),
    });

    http.route({
      path: "/api/auth/two-factor/disable",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);
        let parsed: { password: string };
        try {
          parsed = parse(
            v.object({
              password: v.string(),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = readCookie(request, ACCESS_TOKEN_COOKIE);
        if (!token) {
          return new Response(JSON.stringify({ success: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let result;
        try {
          result = await ctx.runAction(actions.twoFactorDisable, {
            token,
            password: parsed.password,
          });
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });

    http.route({
      path: "/api/auth/two-factor/generate-backup-codes",
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const body = await request.json().catch(() => undefined);
        let parsed: { password: string };
        try {
          parsed = parse(
            v.object({
              password: v.string(),
            }),
            body,
          );
        } catch {
          return new Response(JSON.stringify({ success: false, reason: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const token = readCookie(request, ACCESS_TOKEN_COOKIE);
        if (!token) {
          return new Response(JSON.stringify({ success: false, reason: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let result;
        try {
          result = await ctx.runAction(actions.twoFactorGenerateBackupCodes, {
            token,
            password: parsed.password,
          });
        } catch (error) {
          const { status, reason } = errorStatusAndReason(error);
          return buildErrorResponse(status, reason);
        }

        if (result.error) {
          return buildErrorResponse(401, result.error);
        }

        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });
  }

  if (!component) {
    return;
  }

  http.route({
    pathPrefix: "/api/auth/reset-password/",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const url = new URL(request.url);
      const token = url.pathname.split("/").pop() ?? "";
      const callbackURL = url.searchParams.get("callbackURL");

      if (!callbackURL) {
        return new Response("Missing callbackURL", { status: 400 });
      }

      const tokenHash = await hashToken(token);
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

      const tokenHash = await hashToken(token);
      const result = await ctx.runMutation(component.identity.verifyEmail, {
        tokenHash,
        provider: "password",
        issuer: "native",
      });

      if (!result.success) {
        if (callbackURL) {
          return buildErrorRedirect(
            callbackURL,
            result.reason === "expired" ? "EXPIRED_TOKEN" : "INVALID_TOKEN",
          );
        }
        return new Response(
          JSON.stringify({ success: false, reason: result.reason ?? "invalid" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
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

      try {
        const result = await handleUpdateSession(ctx, component, parsed.refreshToken);
        return new Response(JSON.stringify({ success: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ success: false, reason: "invalid_refresh_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }),
  });

  http.route({
    path: "/api/auth/session",
    method: "GET",
    handler: httpActionGeneric(async (ctx, request) => {
      const token = readCookie(request, ACCESS_TOKEN_COOKIE);
      if (!token) {
        return new Response(JSON.stringify({ user: null, sessionId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      let payload;
      try {
        payload = await verifyToken(token);
      } catch {
        return new Response(JSON.stringify({ user: null, sessionId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = payload.sub;
      const sessionId = payload.sessionId;
      if (typeof userId !== "string" || typeof sessionId !== "string") {
        return new Response(JSON.stringify({ user: null, sessionId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const session = await ctx.runQuery(component.native.sessions.getSessionByToken, { token });
      if (!session || session.sessionId !== sessionId || (session.expiresAt ?? 0) < Date.now()) {
        return new Response(JSON.stringify({ user: null, sessionId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await ctx.runQuery(component.native.users.getUserById, { userId });
      if (!user) {
        return new Response(JSON.stringify({ user: null, sessionId: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ user: toNativeAuthUser(user), sessionId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}
