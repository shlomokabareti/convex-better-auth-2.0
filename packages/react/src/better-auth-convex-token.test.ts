import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createBetterAuthConvexTokenCache,
  decodeJwtExpirationMs,
} from "./better-auth-convex-token";

describe("better auth convex token cache", () => {
  it("decodes JWT expiration timestamps", () => {
    const token = createJwt({ exp: 200 });

    assert.equal(decodeJwtExpirationMs(token), 200_000);
  });

  it("reuses cached JWTs with enough lifetime remaining", async () => {
    let fetches = 0;
    const cache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () => {
        fetches++;
        return createJwt({ exp: 200 });
      },
      now: () => 100_000,
    });

    assert.equal(await cache.getToken(), createJwt({ exp: 200 }));
    assert.equal(await cache.getToken(), createJwt({ exp: 200 }));
    assert.equal(fetches, 1);
  });

  it("refreshes JWTs inside the expiration tolerance window", async () => {
    const tokens = [createJwt({ exp: 130 }), createJwt({ exp: 260 })];
    const cache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () => tokens.shift() ?? null,
      now: () => 100_000,
    });

    assert.equal(await cache.getToken(), createJwt({ exp: 130 }));
    assert.equal(await cache.getToken(), createJwt({ exp: 260 }));
  });

  it("dedupes concurrent token refreshes", async () => {
    let fetches = 0;
    const resolverRef: {
      current?: (token: string) => void;
    } = {};
    const cache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () =>
        await new Promise<string>((resolve) => {
          fetches++;
          resolverRef.current = resolve;
        }),
      now: () => 100_000,
    });

    const first = cache.getToken();
    const second = cache.getToken();
    if (resolverRef.current === undefined) {
      throw new Error("token refresh did not start");
    }
    const resolvePendingToken = resolverRef.current;
    resolvePendingToken(createJwt({ exp: 300 }));

    assert.equal(await first, createJwt({ exp: 300 }));
    assert.equal(await second, createJwt({ exp: 300 }));
    assert.equal(fetches, 1);
  });

  it("keeps a valid cached JWT on transient refresh failure", async () => {
    const failures: Array<{
      message: string | null;
      forceRefreshToken: boolean;
      hadCachedToken: boolean;
      hadFallbackToken: boolean;
    }> = [];
    const cache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () => createJwt({ exp: 300 }),
      now: () => 100_000,
    });

    assert.equal(await cache.getToken(), createJwt({ exp: 300 }));

    const failingCache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () => {
        throw new Error("network failed");
      },
      initialToken: createJwt({ exp: 300 }),
      now: () => 100_000,
      onTokenRefreshFailure: (failure) => {
        failures.push({
          message: failure.error instanceof Error ? failure.error.message : null,
          forceRefreshToken: failure.forceRefreshToken,
          hadCachedToken: failure.hadCachedToken,
          hadFallbackToken: failure.hadFallbackToken,
        });
      },
    });

    assert.equal(await failingCache.getToken({ forceRefreshToken: true }), createJwt({ exp: 300 }));
    assert.deepEqual(failures, [
      {
        message: "network failed",
        forceRefreshToken: true,
        hadCachedToken: true,
        hadFallbackToken: true,
      },
    ]);
  });

  it("reports terminal refresh failure when no cached fallback exists", async () => {
    const failures: Array<{
      message: string | null;
      forceRefreshToken: boolean;
      hadCachedToken: boolean;
      hadFallbackToken: boolean;
    }> = [];
    const cache = createBetterAuthConvexTokenCache({
      fetchFreshToken: async () => null,
      now: () => 100_000,
      onTokenRefreshFailure: (failure) => {
        failures.push({
          message: failure.error instanceof Error ? failure.error.message : null,
          forceRefreshToken: failure.forceRefreshToken,
          hadCachedToken: failure.hadCachedToken,
          hadFallbackToken: failure.hadFallbackToken,
        });
      },
    });

    assert.equal(await cache.getToken({ forceRefreshToken: true }), null);
    assert.deepEqual(failures, [
      {
        message: "Better Auth token refresh returned no token.",
        forceRefreshToken: true,
        hadCachedToken: false,
        hadFallbackToken: false,
      },
    ]);
  });
});

function createJwt(payload: { exp: number }) {
  return [
    encodeBase64Url({ alg: "RS256", typ: "JWT" }),
    encodeBase64Url(payload),
    "signature",
  ].join(".");
}

function encodeBase64Url(payload: object) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
