import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { createTestSessionHandler } from "./createTestSessionHandler";

// ---------------------------------------------------------------------------
// Proof matrix for Increment 6a — the test-session handler.
//
// THE invariant: fail-closed. The endpoint does not exist (404) unless BOTH the
// flag is on AND a secret is configured; it rejects (403) any caller without the
// timing-safe-matching secret; only then does it forward a server-side sign-in
// to the Better-Auth handler (skipping the UI form).
// ---------------------------------------------------------------------------

const ctx = { marker: "ctx" };

function only<T>(values: readonly T[], message: string): T {
  const [value] = values;
  assert.ok(value !== undefined, message);
  return value;
}

// Fake Better-Auth runtime: createAuth(ctx).handler(request) echoes the forwarded
// request so we can assert what got forwarded, and returns a 200 "session".
function fakeCreateAuth() {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const createAuth = (_ctx: unknown) => ({
    handler: async (request: Request) => {
      calls.push({
        url: request.url,
        method: request.method,
        body: await request.clone().json(),
      });
      return new Response(JSON.stringify({ token: "session-token", forwarded: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    options: {
      baseURL: "https://app.test",
      basePath: "/api/auth",
      trustedOrigins: ["https://app.test"],
    },
  });
  return { createAuth, calls };
}

function makeRequest(
  secret: string | null,
  body: unknown = { email: "a@b.test", password: "pw" },
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret !== null) {
    headers["x-convex-auth-test-secret"] = secret;
  }
  return new Request("https://app.test/api/auth/test-session", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const SECRET = "super-secret-test-token-value-1234567890";

describe("createTestSessionHandler — fail-closed contract", () => {
  it("404 when disabled (flag off)", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => false,
      getSecret: () => SECRET,
    });
    const res = await handler(ctx, makeRequest(SECRET));
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0, "must not forward to Better-Auth when disabled");
  });

  it("404 when no secret is configured (even if flag on)", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => undefined,
    });
    const res = await handler(ctx, makeRequest(SECRET));
    assert.equal(res.status, 404);
    assert.equal(calls.length, 0);
  });

  it("403 when the secret header is absent", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => SECRET,
    });
    const res = await handler(ctx, makeRequest(null));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });

  it("403 when the secret is wrong (no forward to Better-Auth)", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => SECRET,
    });
    const res = await handler(ctx, makeRequest("wrong-secret"));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });

  it("400 when the body lacks email/password", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => SECRET,
    });
    const res = await handler(ctx, makeRequest(SECRET, { email: "a@b.test" }));
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it("forwards a server-side sign-in to Better-Auth on a valid secret + creds", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => SECRET,
    });
    const res = await handler(
      ctx,
      makeRequest(SECRET, { email: "shlomo@pile.nyc", password: "12345678" }),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      token: "session-token",
      forwarded: true,
    });
    // It forwarded a POST to the Better-Auth sign-in/email path with the creds.
    assert.equal(calls.length, 1);
    const call = only(calls, "forwarded sign-in request is missing");
    assert.equal(call.method, "POST");
    assert.ok(call.url.endsWith("/api/auth/sign-in/email"), `forwarded url: ${call.url}`);
    assert.deepEqual(call.body, {
      email: "shlomo@pile.nyc",
      password: "12345678",
    });
  });

  it("honors a custom basePath + secret header name", async () => {
    const { createAuth, calls } = fakeCreateAuth();
    const handler = createTestSessionHandler({
      createAuth,
      isEnabled: () => true,
      getSecret: () => SECRET,
      basePath: "/auth",
      secretHeaderName: "x-custom-secret",
    });
    const req = new Request("https://app.test/auth/test-session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-custom-secret": SECRET,
      },
      body: JSON.stringify({ email: "a@b.test", password: "pw" }),
    });
    const res = await handler(ctx, req);
    assert.equal(res.status, 200);
    assert.ok(
      only(calls, "forwarded custom-path request is missing").url.endsWith("/auth/sign-in/email"),
    );
  });
});
