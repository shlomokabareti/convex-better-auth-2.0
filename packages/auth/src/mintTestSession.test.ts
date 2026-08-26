import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { mintConvexAuthTestSession } from "./testing";

// ---------------------------------------------------------------------------
// Form-free headless session mint. Mocks fetch to assert the two-step flow:
//   1. POST {site}/test-session  (secret + creds)  → session (Set-Cookie / bearer)
//   2. GET  {site}/apiconvex-auth/convex/token (session) → Convex JWT
// ---------------------------------------------------------------------------

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

function callAt(calls: readonly Call[], index: number): Call {
  const call = calls[index];
  assert.ok(call !== undefined, `expected recorded request ${index + 1}`);
  return call;
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function recordingFetch(handlers: {
  testSession: () => Response;
  convexToken: (call: Call) => Response;
}): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input);
    const headers: Record<string, string> = {};
    for (const [k, v] of new Headers(init?.headers).entries()) {
      headers[k.toLowerCase()] = v;
    }
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    if (url.endsWith("/test-session")) return handlers.testSession();
    if (url.endsWith("/convex/token")) return handlers.convexToken(call);
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetchImpl, calls };
}

const SITE = "https://calm-test.convex.site";
const BASE = {
  siteUrl: SITE,
  secret: "the-shared-secret-1234567890",
  email: "shlomo@crm.nyc",
  password: "12345678",
};

describe("mintConvexAuthTestSession — headless form-free mint", () => {
  it("mints via /test-session then exchanges the cookie session for a Convex JWT", async () => {
    const { fetchImpl, calls } = recordingFetch({
      testSession: () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "set-cookie": "better-auth.session_token=sess-abc; Path=/; HttpOnly",
          },
        }),
      convexToken: () =>
        new Response(JSON.stringify({ token: "convex-jwt-xyz" }), {
          status: 200,
        }),
    });

    const session = await mintConvexAuthTestSession({ ...BASE, fetchImpl });
    assert.equal(session.convexToken, "convex-jwt-xyz");
    assert.equal(session.cookie, "better-auth.session_token=sess-abc");

    // Step 1: POST /test-session with the secret header + creds.
    const mintCall = callAt(calls, 0);
    assert.equal(mintCall.method, "POST");
    assert.ok(mintCall.url.endsWith("/test-session"));
    assert.equal(mintCall.headers["x-convex-auth-test-secret"], BASE.secret);
    assert.deepEqual(JSON.parse(mintCall.body ?? "{}"), {
      email: BASE.email,
      password: BASE.password,
    });

    // Step 2: GET /api/auth/convex/token replaying the session cookie.
    const tokenCall = callAt(calls, 1);
    assert.equal(tokenCall.method, "GET");
    assert.ok(tokenCall.url.endsWith("/api/auth/convex/token"));
    assert.equal(tokenCall.headers.cookie, "better-auth.session_token=sess-abc");
  });

  it("uses a bearer set-auth-token when the deployment returns one (no cookie)", async () => {
    const { fetchImpl, calls } = recordingFetch({
      testSession: () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "set-auth-token": "bearer-sess-1" },
        }),
      convexToken: () =>
        new Response(JSON.stringify({ token: "jwt-from-bearer" }), {
          status: 200,
        }),
    });

    const session = await mintConvexAuthTestSession({ ...BASE, fetchImpl });
    assert.equal(session.convexToken, "jwt-from-bearer");
    assert.equal(session.sessionToken, "bearer-sess-1");
    assert.equal(callAt(calls, 1).headers.authorization, "Bearer bearer-sess-1");
  });

  it("throws a guidance error when the mint is rejected (wrong secret / disabled)", async () => {
    const { fetchImpl } = recordingFetch({
      testSession: () => new Response("Forbidden", { status: 403 }),
      convexToken: () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(
      () => mintConvexAuthTestSession({ ...BASE, fetchImpl }),
      /test-session mint failed \(403/,
    );
  });

  it("throws when sign-in returns no session material", async () => {
    const { fetchImpl } = recordingFetch({
      testSession: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      convexToken: () => new Response("{}", { status: 200 }),
    });
    await assert.rejects(
      () => mintConvexAuthTestSession({ ...BASE, fetchImpl }),
      /returned no session/,
    );
  });

  it("throws when the convex token exchange fails", async () => {
    const { fetchImpl } = recordingFetch({
      testSession: () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "set-cookie": "better-auth.session_token=s; Path=/" },
        }),
      convexToken: () => new Response("nope", { status: 401 }),
    });
    await assert.rejects(
      () => mintConvexAuthTestSession({ ...BASE, fetchImpl }),
      /convex token exchange failed \(401/,
    );
  });

  it("honors custom testSessionPath + basePath", async () => {
    const { fetchImpl, calls } = recordingFetch({
      testSession: () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "set-cookie": "better-auth.session_token=s; Path=/" },
        }),
      convexToken: () => new Response(JSON.stringify({ token: "t" }), { status: 200 }),
    });
    await mintConvexAuthTestSession({
      ...BASE,
      fetchImpl,
      testSessionPath: "/internal/test-session",
      basePath: "convex-auth",
    });
    assert.ok(callAt(calls, 0).url.endsWith("/internal/test-session"));
    assert.ok(callAt(calls, 1).url.endsWith("convex-auth/convex/token"));
  });
});
