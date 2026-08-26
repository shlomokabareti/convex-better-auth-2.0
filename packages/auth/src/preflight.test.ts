import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { runAuthPreflight } from "./preflight";

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

describe("auth preflight", () => {
  it("fails fast when required URLs are missing", async () => {
    const result = await runAuthPreflight({});

    assert.equal(result.ok, false);
    assert.equal(
      result.checks.some(
        (check) => check.name === "VITE_BETTER_AUTH_URL" && !check.ok
      ),
      true
    );
    assert.equal(
      result.checks.some(
        (check) => check.name === "VITE_CONVEX_URL" && !check.ok
      ),
      true
    );
  });

  it("checks Better Auth token endpoint and Convex reachability", async () => {
    const calls: string[] = [];
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async (input) => {
        calls.push(requestUrl(input));
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      calls.includes("https://auth.example.test/api/auth/get-session"),
      true
    );
    assert.equal(
      calls.includes("https://auth.example.test/api/auth/convex/token"),
      true
    );
    assert.equal(
      calls.includes("https://auth.example.test/api/auth/convex/jwks"),
      true
    );
    assert.equal(calls.includes("https://convex.example.test/"), true);
  });

  it("fails when the Better Auth session endpoint is missing", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async (input) => {
        if (
          requestUrl(input) === "https://auth.example.test/api/auth/get-session"
        ) {
          return new Response("not found", { status: 404 });
        }
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "Better Auth /get-session" &&
          !check.ok &&
          check.severity === "error"
      ),
      true
    );
  });

  it("fails when the Better Auth Convex JWKS endpoint is missing", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async (input) => {
        if (
          requestUrl(input) === "https://auth.example.test/api/auth/convex/jwks"
        ) {
          return new Response("not found", { status: 404 });
        }
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "Better Auth /convex/jwks" &&
          !check.ok &&
          check.severity === "error"
      ),
      true
    );
  });

  it("fails when an already-running app server is serving the wrong env", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async (input) => {
        if (
          requestUrl(input) ===
          "http://127.0.0.1:4173/src/lib/auth-runtime.better-auth.tsx"
        ) {
          return new Response("const betterAuthBaseUrl = '';", { status: 200 });
        }
        return new Response("ok", { status: 200 });
      },
      appServer: {
        baseUrl: "http://127.0.0.1:4173",
        expectedValues: ["https://auth.example.test/api/auth"],
        probePaths: ["/src/lib/auth-runtime.better-auth.tsx"],
      },
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "App served env" &&
          check.message.includes("not serving")
      ),
      true
    );
  });

  it("checks Vite module scripts for served env", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async (input) => {
        const url = requestUrl(input);
        if (url === "http://127.0.0.1:5173/") {
          return new Response(
            [
              "<!doctype html>",
              '<script type="module" src="/@vite/client"></script>',
              '<script type="module" src="/src/main.tsx"></script>',
            ].join("\n"),
            { status: 200 }
          );
        }
        if (url === "http://127.0.0.1:5173/src/main.tsx") {
          return new Response(
            [
              "const authUrl = 'https://auth.example.test/api/auth';",
              "const convexUrl = 'https://convex.example.test';",
            ].join("\n"),
            { status: 200 }
          );
        }
        return new Response("ok", { status: 200 });
      },
      appServer: {
        baseUrl: "http://127.0.0.1:5173",
        expectedValues: [
          "https://auth.example.test/api/auth",
          "https://convex.example.test",
        ],
      },
    });

    assert.equal(result.ok, true, JSON.stringify(result.checks));
    assert.equal(
      result.checks.filter(
        (check) => check.name === "App served env" && check.ok
      ).length,
      2
    );
  });

  it("accepts local link/file dependency package versions", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      expectedPackageVersion: "link:convex-auth",
      actualPackageVersion: "0.1.83",
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });

    assert.equal(result.ok, true);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "Package version" &&
          check.ok &&
          check.message.includes("local dependency link:convex-auth")
      ),
      true
    );
  });

  it("checks backend setup files and required backend env groups", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async () => new Response("ok", { status: 200 }),
      backendSetup: {
        files: [
          {
            name: "Convex Auth component registration",
            path: "convex/convex.config.ts",
            content:
              'import convexAuth from "convex-auth/convex.config.js";\napp.use(convexAuth);',
            requiredSnippets: ["convex-auth/convex.config", "app.use"],
          },
        ],
        envGroups: [
          {
            name: "Backend Better Auth site URL",
            envNames: ["CONVEX_SITE_URL", "BETTER_AUTH_URL"],
            values: {
              CONVEX_SITE_URL: "https://convex.example.test",
            },
          },
        ],
      },
    });

    assert.equal(result.ok, true);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "Convex Auth component registration" && check.ok
      ),
      true
    );
    assert.equal(
      result.checks.some(
        (check) => check.name === "Backend Better Auth site URL" && check.ok
      ),
      true
    );
  });

  it("fails when backend setup files are missing required snippets", async () => {
    const result = await runAuthPreflight({
      betterAuthUrl: "https://auth.example.test/api/auth",
      convexUrl: "https://convex.example.test",
      fetchImpl: async () => new Response("ok", { status: 200 }),
      backendSetup: {
        files: [
          {
            name: "Convex HTTP auth routes",
            path: "convex/http.ts",
            content: "const http = httpRouter();",
            requiredSnippets: ["httpRouter", "registerAuthRoutes"],
          },
        ],
      },
    });

    assert.equal(result.ok, false);
    assert.equal(
      result.checks.some(
        (check) =>
          check.name === "Convex HTTP auth routes" &&
          !check.ok &&
          check.message.includes("registerAuthRoutes")
      ),
      true
    );
  });
});
