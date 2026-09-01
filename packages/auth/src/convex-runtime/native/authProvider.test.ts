import { describe, expect, it, beforeEach } from "vitest";
import { createConvexAuthProvider } from "./authProvider.js";

function withEnv<T>(env: Record<string, string>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    process.env[key] = env[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

describe("createConvexAuthProvider", () => {
  beforeEach(() => {
    delete process.env.CONVEX_SITE_URL;
  });

  it("builds a default provider from CONVEX_SITE_URL", () => {
    const provider = withEnv({ CONVEX_SITE_URL: "https://test.convex.site" }, () =>
      createConvexAuthProvider(),
    );
    expect(provider).toEqual({
      type: "customJwt",
      issuer: "https://test.convex.site",
      applicationID: "convex",
      algorithm: "RS256",
      jwks: "https://test.convex.site/.well-known/jwks.json",
    });
  });

  it("trims a trailing slash from CONVEX_SITE_URL", () => {
    const provider = withEnv({ CONVEX_SITE_URL: "https://test.convex.site/" }, () =>
      createConvexAuthProvider(),
    );
    expect(provider.issuer).toBe("https://test.convex.site");
    expect(provider.jwks).toBe("https://test.convex.site/.well-known/jwks.json");
  });

  it("allows explicit issuer and applicationID", () => {
    const provider = createConvexAuthProvider({
      issuer: "https://app.example.com",
      applicationID: "my-app",
      jwks: "https://app.example.com/.well-known/jwks.json",
    });
    expect(provider).toEqual({
      type: "customJwt",
      issuer: "https://app.example.com",
      applicationID: "my-app",
      algorithm: "RS256",
      jwks: "https://app.example.com/.well-known/jwks.json",
    });
  });

  it("throws when CONVEX_SITE_URL is missing and no issuer is given", () => {
    expect(() => createConvexAuthProvider()).toThrow(
      "createConvexAuthProvider requires an explicit issuer or the CONVEX_SITE_URL environment variable.",
    );
  });
});
