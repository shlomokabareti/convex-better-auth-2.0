import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  getBetterAuthConvexBearerToken,
  type ConvexBetterAuthClient,
} from "./better-auth-runtime";

function createAuthClient(
  token: string | null
): Pick<ConvexBetterAuthClient, "convex"> {
  return {
    convex: {
      token: async () => ({
        data: {
          token,
        },
      }),
    },
  };
}

describe("better auth runtime token lookup", () => {
  it("uses the Better Auth Convex client plugin when available", async () => {
    let fetchCalled = false;
    const token = await getBetterAuthConvexBearerToken({
      authClient: createAuthClient("plugin-token"),
      betterAuthBaseUrl: "https://auth.example.test/api/auth",
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(JSON.stringify({ token: "fetch-token" }));
      },
    });

    assert.equal(token, "plugin-token");
    assert.equal(fetchCalled, false);
  });

  it("falls back to the raw token endpoint for older clients", async () => {
    const token = await getBetterAuthConvexBearerToken({
      betterAuthBaseUrl: "https://auth.example.test/api/auth",
      fetchImpl: async (input, init) => {
        assert.equal(input, "https://auth.example.test/api/auth/convex/token");
        assert.equal(init?.credentials, "include");
        return new Response(JSON.stringify({ token: "fetch-token" }));
      },
    });

    assert.equal(token, "fetch-token");
  });

  it("returns null when neither source has a token", async () => {
    const token = await getBetterAuthConvexBearerToken({
      authClient: createAuthClient(null),
      fetchImpl: async () => new Response(JSON.stringify({}), { status: 401 }),
    });

    assert.equal(token, null);
  });
});
