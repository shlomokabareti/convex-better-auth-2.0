import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseSetCookieHeader } from "better-auth/cookies";
import { describe, it } from "vitest";

import {
  BETTER_AUTH_TEST_BASE_PATH,
  BETTER_AUTH_TEST_BASE_URL,
  createBetterAuthTestInstance,
  type BetterAuthTestInstance,
} from "./test-auth";

const TEST_PASSWORD = "12345678";

function only<T>(values: readonly T[], message: string): T {
  const [value] = values;
  assert.ok(value !== undefined, message);
  return value;
}

describe("Better Auth test-utils integration", () => {
  it("keeps test-utils on a separate test-only auth instance", async () => {
    const { auth } = createBetterAuthTestInstance();
    const ctx = await auth.$context;

    assert.equal(typeof ctx.test.createUser, "function");
    assert.equal(typeof ctx.test.saveUser, "function");
    assert.equal(typeof ctx.test.login, "function");
    assert.equal(typeof ctx.test.getAuthHeaders, "function");
    assert.equal(typeof ctx.test.getCookies, "function");
    assert.equal(typeof ctx.test.getOTP, "function");
    assert.equal(typeof ctx.test.clearOTPs, "function");
  });

  it("does not load test-utils from the production Convex auth runtime", () => {
    const productionRuntime = readFileSync(new URL("./convex.ts", import.meta.url), "utf8");

    assert.equal(productionRuntime.includes("testUtils"), false);
  });

  it("covers email/password sign-up, sign-in, and session lifecycle with provider cookies", async () => {
    const instance = createBetterAuthTestInstance();
    const email = uniqueEmail("session");

    const signUpResponse = await authRequest(instance, "/sign-up/email", {
      method: "POST",
      body: {
        name: "Session Test",
        email,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(signUpResponse.status, 200);
    const signUpCookie = requireCookieHeader(signUpResponse);

    const signedUpSession = await getSessionJson(instance, signUpCookie);
    assert.equal(signedUpSession?.user.email, email);

    const signOutResponse = await authRequest(instance, "/sign-out", {
      method: "POST",
      cookie: signUpCookie,
    });
    assert.equal(signOutResponse.status, 200);

    const signedOutSession = await getSessionJson(instance, signUpCookie);
    assert.equal(signedOutSession, null);

    const signInResponse = await authRequest(instance, "/sign-in/email", {
      method: "POST",
      body: {
        email,
        password: TEST_PASSWORD,
      },
    });
    assert.equal(signInResponse.status, 200);
    const signInCookie = requireCookieHeader(signInResponse);

    const signedInSession = await getSessionJson(instance, signInCookie);
    assert.equal(signedInSession?.user.email, email);
  });

  it("uses test-utils auth helpers for direct session and cookie setup", async () => {
    const { auth } = createBetterAuthTestInstance();
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({
      email: uniqueEmail("helper"),
      emailVerified: true,
      name: "Helper Test",
    });
    await test.saveUser(user);

    const login = await test.login({ userId: user.id });
    assert.equal(login.user.email, user.email);
    assert.equal(login.session.userId, user.id);
    assert.ok(login.token.length > 0);
    assert.ok(login.headers.get("cookie")?.includes("better-auth.session_token"));
    assert.ok(login.cookies.some((cookie) => cookie.name === "better-auth.session_token"));

    const sessionFromLogin = await auth.api.getSession({
      headers: login.headers,
    });
    assert.equal(sessionFromLogin?.user.id, user.id);

    const headers = await test.getAuthHeaders({ userId: user.id });
    const sessionFromHeaders = await auth.api.getSession({ headers });
    assert.equal(sessionFromHeaders?.user.email, user.email);

    const cookies = await test.getCookies({
      userId: user.id,
      domain: "auth.test",
    });
    assert.ok(
      cookies.some(
        (cookie) =>
          cookie.name === "better-auth.session_token" &&
          cookie.domain === "auth.test" &&
          cookie.httpOnly === true,
      ),
    );
  });

  it("captures provider-created email OTPs without mocking transport", async () => {
    const { auth, deliveredOtps } = createBetterAuthTestInstance();
    const ctx = await auth.$context;
    const test = ctx.test;
    assert.equal("clearOTPs" in test, true);
    assert.equal("getOTP" in test, true);
    test.clearOTPs?.();

    const email = uniqueEmail("otp");
    const user = test.createUser({ email, emailVerified: false });
    await test.saveUser(user);

    const response = await auth.api.sendVerificationOTP({
      body: { email, type: "email-verification" },
    });

    assert.equal(response.success, true);
    assert.equal(deliveredOtps.length, 1);
    const deliveredOtp = only(deliveredOtps, "delivered OTP is missing");
    assert.equal(deliveredOtp.email, email);
    assert.equal(deliveredOtp.type, "email-verification");
    assert.equal(test.getOTP?.(email), deliveredOtp.otp);
  });
});

type AuthRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  cookie?: string;
};

type SessionJson = {
  user: {
    id: string;
    email: string;
  };
} | null;

async function authRequest(
  instance: BetterAuthTestInstance,
  path: string,
  options: AuthRequestOptions = {},
): Promise<Response> {
  const headers = new Headers();
  headers.set("origin", BETTER_AUTH_TEST_BASE_URL);
  if (options.cookie !== undefined) {
    headers.set("cookie", options.cookie);
  }
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  return instance.auth.handler(
    new Request(`${BETTER_AUTH_TEST_BASE_URL}${BETTER_AUTH_TEST_BASE_PATH}${path}`, init),
  );
}

async function getSessionJson(
  instance: BetterAuthTestInstance,
  cookie: string,
): Promise<SessionJson> {
  const response = await authRequest(instance, "/get-session", { cookie });
  assert.equal(response.status, 200);
  const value: unknown = await response.json();
  if (value === null) return null;
  assert.ok(typeof value === "object" && !Array.isArray(value));
  const user = Reflect.get(value, "user");
  assert.ok(typeof user === "object" && user !== null && !Array.isArray(user));
  const id = Reflect.get(user, "id");
  const email = Reflect.get(user, "email");
  assert.equal(typeof id, "string");
  assert.equal(typeof email, "string");
  return { user: { id, email } };
}

function requireCookieHeader(response: Response): string {
  const parsed = parseSetCookieHeader(response.headers.get("set-cookie") ?? "");
  const cookieHeader = Array.from(parsed.entries())
    .filter(([, cookie]) => cookie.value.length > 0)
    .map(([name, cookie]) => `${name}=${cookie.value}`)
    .join("; ");
  assert.ok(cookieHeader.includes("better-auth.session_token"));
  return cookieHeader;
}

function uniqueEmail(label: string): string {
  return `shlomo+better-auth-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@convex.nyc`;
}
