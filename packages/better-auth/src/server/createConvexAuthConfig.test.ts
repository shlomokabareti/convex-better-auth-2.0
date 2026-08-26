import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createConvexAuthConfig,
  createPublicBetterAuthJwks,
} from "./createConvexAuthConfig";

describe("createConvexAuthConfig", () => {
  it("uses explicit Better Auth URL without reading Convex site env", () => {
    const previousSiteUrl = process.env.CONVEX_SITE_URL;
    delete process.env.CONVEX_SITE_URL;

    try {
      const provider = createConvexAuthConfig({
        baseURL: "https://auth.veil.test/api/auth",
      });

      assert.equal(provider.type, "customJwt");
      assert.equal(provider.issuer, "https://auth.veil.test");
      assert.equal(provider.applicationID, "convex");
      assert.equal(provider.algorithm, "RS256");
      assert.equal(
        provider.jwks,
        "https://auth.veil.test/api/auth/convex/jwks"
      );
    } finally {
      restoreEnv("CONVEX_SITE_URL", previousSiteUrl);
    }
  });

  it("builds same-origin Convex auth config without importing the upstream helper", () => {
    const previousSiteUrl = process.env.CONVEX_SITE_URL;
    process.env.CONVEX_SITE_URL = "https://veil-dev.convex.example.com/";

    try {
      const provider = createConvexAuthConfig();

      assert.equal(provider.type, "customJwt");
      assert.equal(provider.issuer, "https://veil-dev.convex.example.com");
      assert.equal(provider.applicationID, "convex");
      assert.equal(
        provider.jwks,
        "https://veil-dev.convex.example.com/api/auth/convex/jwks"
      );
    } finally {
      restoreEnv("CONVEX_SITE_URL", previousSiteUrl);
    }
  });

  it("serializes Better Auth stored JWKS documents into public JWKS data URLs", () => {
    const publicKey = {
      kty: "OKP",
      crv: "Ed25519",
      x: "test-public-key",
    };
    const jwks = [
      {
        id: "key_123",
        publicKey: JSON.stringify(publicKey),
        privateKey: "{}",
        createdAt: 1,
        alg: "EdDSA",
      },
    ];

    assert.deepEqual(createPublicBetterAuthJwks(jwks), {
      keys: [
        {
          alg: "EdDSA",
          ...publicKey,
          kid: "key_123",
        },
      ],
    });

    const provider = createConvexAuthConfig({
      issuer: "https://auth.veil.test",
      jwks: JSON.stringify(jwks),
    });
    const encoded = provider.jwks.replace(
      "data:text/plain;charset=utf-8;base64,",
      ""
    );
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    ) as unknown;

    assert.deepEqual(decoded, createPublicBetterAuthJwks(jwks));
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
