import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it } from "vitest";

import {
  assertConvexAuthAppEnv,
  assertConvexAuthCredentialsEnv,
  createAuthenticatedConvexHttpClient,
  getConvexAuthTestCredentials,
  hasConvexAuthTestCredentials,
  readConvexAuthToken,
  runConvexAuthPreflightCommand,
  signInWithConvexAuthEmailPassword,
  waitForAuthenticatedConvexReady,
  waitForExposedAuthRuntime,
  waitForExposedConvexRuntime,
  type ConvexAuthTestingLocator,
  type ConvexAuthTestingPage,
  type ConvexAuthTestingPageWithUi,
} from "./testing";

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

type TestRuntime = {
  __authRuntime?: {
    getConvexToken?: (args?: { forceRefreshToken?: boolean }) => Promise<string | null>;
  };
  __convexApi?: unknown;
  __convexClient?: unknown;
};

class RuntimePage implements ConvexAuthTestingPage {
  constructor(private readonly runtime: TestRuntime) {}

  async evaluate<T, TArg>(pageFunction: (arg: TArg) => T | Promise<T>, arg: TArg): Promise<T> {
    const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
    const previousWindow = Reflect.get(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: this.runtime,
    });

    try {
      return await pageFunction(arg);
    } finally {
      if (hadWindow) {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previousWindow,
        });
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    }
  }
}

class FormLocator implements ConvexAuthTestingLocator {
  constructor(
    private readonly page: SignInPage,
    private readonly selector: string,
  ) {}

  first() {
    return this;
  }

  async fill(value: string) {
    this.page.values.set(this.selector, value);
  }

  async click() {
    this.page.clickedSubmit = true;
    this.page.currentUrl = "http://127.0.0.1:4173/app";
  }
}

class SignInPage implements ConvexAuthTestingPageWithUi {
  currentUrl = "http://127.0.0.1:4173/";
  clickedSubmit = false;
  readonly values = new Map<string, string>();

  async goto(url: string) {
    this.currentUrl = `http://127.0.0.1:4173${url}`;
  }

  getByRole() {
    return new FormLocator(this, "submit");
  }

  locator(selector: string) {
    return new FormLocator(this, selector);
  }

  url() {
    return this.currentUrl;
  }

  async waitForSelector() {}

  async waitForURL() {}
}

describe("testing helpers", () => {
  it("waits for exposed Convex runtime", async () => {
    const page = new RuntimePage({
      __convexApi: {},
      __convexClient: {},
    });

    await waitForExposedConvexRuntime(page, {
      timeoutMs: 1,
      pollIntervalMs: 1,
    });
  });

  it("waits for exposed auth runtime", async () => {
    const page = new RuntimePage({
      __authRuntime: {
        getConvexToken: async () => "test-token",
      },
    });

    await waitForExposedAuthRuntime(page, { timeoutMs: 1, pollIntervalMs: 1 });
  });

  it("reads auth token from exposed auth runtime", async () => {
    let receivedForceRefreshToken: boolean | undefined;
    const page = new RuntimePage({
      __convexApi: {},
      __convexClient: {},
      __authRuntime: {
        getConvexToken: async (args) => {
          receivedForceRefreshToken = args?.forceRefreshToken;
          return "test-token";
        },
      },
    });

    assert.equal(await readConvexAuthToken(page, { forceRefreshToken: true }), "test-token");
    assert.equal(receivedForceRefreshToken, true);
  });

  it("treats authenticated Convex readiness as a reusable token contract", async () => {
    const page = new RuntimePage({
      __convexApi: {},
      __convexClient: {},
      __authRuntime: {
        getConvexToken: async () => "ready-token",
      },
    });

    assert.equal(await waitForAuthenticatedConvexReady(page), "ready-token");
  });

  it("creates authenticated Convex HTTP client with explicit Convex URL", async () => {
    const page = new RuntimePage({
      __convexApi: {},
      __convexClient: {},
      __authRuntime: {
        getConvexToken: async () => "test-token",
      },
    });

    const client = await createAuthenticatedConvexHttpClient(page, {
      convexUrl: "https://example.convex.cloud",
    });

    assert.ok(client);
  });

  it("fails loudly when Convex URL is missing", async () => {
    const page = new RuntimePage({
      __convexApi: {},
      __convexClient: {},
      __authRuntime: {
        getConvexToken: async () => "test-token",
      },
    });

    await assert.rejects(
      createAuthenticatedConvexHttpClient(page, {
        convexUrlEnvName: "MISSING_CONVEX_URL",
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /MISSING_CONVEX_URL is required/,
    );
  });

  it("reads test credentials from configurable env names", () => {
    const env = {
      AUTH_EMAIL: "person@example.com",
      AUTH_PASSWORD: "secret",
    };

    assert.equal(
      hasConvexAuthTestCredentials({
        env,
        emailEnvName: "AUTH_EMAIL",
        passwordEnvName: "AUTH_PASSWORD",
      }),
      true,
    );
    assert.deepEqual(
      getConvexAuthTestCredentials({
        env,
        emailEnvName: "AUTH_EMAIL",
        passwordEnvName: "AUTH_PASSWORD",
      }),
      { email: "person@example.com", password: "secret" },
    );
  });

  it("asserts and logs E2E environment once", () => {
    const lines: string[] = [];
    const env = {
      PLAYWRIGHT_TEST_BASE_URL: "http://127.0.0.1:4173",
      TEST_USER_EMAIL: "person@example.com",
      TEST_USER_PASSWORD: "secret",
      VITE_CONVEX_URL: "https://example.convex.cloud",
    };

    assertConvexAuthAppEnv({
      env,
      logger: (line) => lines.push(line),
      scope: "app",
    });
    assertConvexAuthCredentialsEnv({
      env,
      logger: (line) => lines.push(line),
      scope: "auth",
    });

    assert.deepEqual(lines, [
      "[setup:app] Base URL: http://127.0.0.1:4173",
      "[setup:app] Convex URL: https://example.convex.cloud",
      "[setup:app] Auth test user: person@example.com",
    ]);
  });

  it.skip("runs auth preflight command from repo metadata and .test-env", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "convex-auth-preflight-"));
    await mkdir(join(repoRoot, "convex"), { recursive: true });
    await mkdir(join(repoRoot, "apps/web"), { recursive: true });
    await mkdir(join(repoRoot, "node_modules/convex-auth"), {
      recursive: true,
    });
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ dependencies: { "convex-auth": "0.1.25" } }),
    );
    await writeFile(join(repoRoot, "apps/web/package.json"), JSON.stringify({}));
    await writeFile(
      join(repoRoot, "node_modules/convex-auth/package.json"),
      JSON.stringify({ version: "0.1.25" }),
    );
    await writeFile(
      join(repoRoot, ".test-env"),
      [
        "VITE_BETTER_AUTH_URL=https:/convex-auth.example.test/apiconvex-auth",
        "VITE_CONVEX_URL=https://convex.example.test",
        "CONVEX_SITE_URL=https://convex-site.example.test",
        "PLAYWRIGHT_TEST_BASE_URL=https://app.example.test",
        "BETTER_AUTH_TRUSTED_ORIGINS=https://app.example.test",
      ].join("\n"),
    );
    await writeFile(
      join(repoRoot, "convex/convex.config.ts"),
      'import convexAuth from "convex-auth/convex.config.js";\napp.use(convexAuth);\n',
    );
    await writeFile(
      join(repoRoot, "convexconvex-auth.config.ts"),
      'import { createConvexAuthConfig } from "convex-auth/better-auth/server";\nexport default { providers: [createConvexAuthConfig()] };\n',
    );
    await writeFile(
      join(repoRoot, "convex/http.ts"),
      'import { httpRouter } from "convex/server";\nimport { registerAuthRoutes } from "./betterAuth";\nconst http = httpRouter();\nregisterAuthRoutes(http);\n',
    );
    await writeFile(
      join(repoRoot, "convex/betterAuth.ts"),
      'import { createBetterAuthConvexRuntime } from "convex-auth/better-auth/convex";\nconst runtime = createBetterAuthConvexRuntime({ components: { betterAuth: components.betterAuth }, refs: { provisionIdentityFromIdentity: components.convexAuth.identity.provisionFromIdentity } });\nexport const registerAuthRoutes = runtime.registerRoutes;\n',
    );

    const lines: string[] = [];
    const env: NodeJS.ProcessEnv = {};
    const exitCode = await runConvexAuthPreflightCommand({
      repoRoot,
      env,
      logger: (line) => lines.push(line),
      fetchImpl: async (input) => {
        if (
          requestUrl(input) === "https://app.example.test/" ||
          requestUrl(input) ===
            "https://app.example.test/src/libconvex-auth-runtime.better-auth.tsx" ||
          requestUrl(input) === "https://app.example.test/src/main.tsx"
        ) {
          return new Response(
            "https:/convex-auth.example.test/apiconvex-auth\nhttps://convex.example.test",
            { status: 200 },
          );
        }
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(env.VITE_BETTER_AUTH_URL, "https:/convex-auth.example.test/apiconvex-auth");
    assert.equal(
      lines.some((line) => line.includes("Auth preflight passed.")),
      true,
    );
    assert.equal(
      lines.some((line) => line.includes("[PASS] Convex Auth component registration")),
      true,
    );
    assert.equal(
      lines.some((line) => line.includes("[PASS] Better Auth trusted origins")),
      true,
    );
  });

  it.skip("passes auth preflight command when runtime trusted origins cover the web app", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "convex-auth-preflight-runtime-origins-"));
    await mkdir(join(repoRoot, "convex"), { recursive: true });
    await mkdir(join(repoRoot, "apps/web"), { recursive: true });
    await mkdir(join(repoRoot, "node_modules/convex-auth"), {
      recursive: true,
    });
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ dependencies: { "convex-auth": "0.1.25" } }),
    );
    await writeFile(join(repoRoot, "apps/web/package.json"), JSON.stringify({}));
    await writeFile(
      join(repoRoot, "node_modules/convex-auth/package.json"),
      JSON.stringify({ version: "0.1.25" }),
    );
    await writeFile(
      join(repoRoot, ".test-env"),
      [
        "VITE_BETTER_AUTH_URL=https:/convex-auth.example.test/apiconvex-auth",
        "VITE_CONVEX_URL=https://convex.example.test",
        "CONVEX_SITE_URL=https://convex-site.example.test",
        "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4173",
      ].join("\n"),
    );
    await writeFile(
      join(repoRoot, "convex/convex.config.ts"),
      'import convexAuth from "convex-auth/convex.config.js";\napp.use(convexAuth);\n',
    );
    await writeFile(
      join(repoRoot, "convexconvex-auth.config.ts"),
      'import { createConvexAuthConfig } from "convex-auth/better-auth/server";\nexport default { providers: [createConvexAuthConfig()] };\n',
    );
    await writeFile(
      join(repoRoot, "convex/http.ts"),
      'import { httpRouter } from "convex/server";\nimport { registerAuthRoutes } from "./betterAuth";\nconst http = httpRouter();\nregisterAuthRoutes(http);\n',
    );
    await writeFile(
      join(repoRoot, "convex/betterAuth.ts"),
      'import { createBetterAuthConvexRuntime } from "convex-auth/better-auth/convex";\nconst runtime = createBetterAuthConvexRuntime({ trustedOrigins: ["http://127.0.0.1:4173"], components: { betterAuth: components.betterAuth }, refs: { provisionIdentityFromIdentity: components.convexAuth.identity.provisionFromIdentity } });\nexport const registerAuthRoutes = runtime.registerRoutes;\n',
    );

    const lines: string[] = [];
    const exitCode = await runConvexAuthPreflightCommand({
      repoRoot,
      env: {},
      logger: (line) => lines.push(line),
      fetchImpl: async (input) => {
        if (requestUrl(input) === "http://127.0.0.1:4173/") {
          return new Response(
            "https:/convex-auth.example.test/apiconvex-auth\nhttps://convex.example.test",
            { status: 200 },
          );
        }
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(
      lines.some((line) =>
        line.includes(
          "[PASS] Better Auth trusted origins: http://127.0.0.1:4173 is allowed by explicit trustedOrigins runtime config.",
        ),
      ),
      true,
    );
  });

  it("fails auth preflight command when trusted origins do not cover the web app", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "convex-auth-preflight-origins-"));
    await mkdir(join(repoRoot, "convex"), { recursive: true });
    await mkdir(join(repoRoot, "apps/web"), { recursive: true });
    await mkdir(join(repoRoot, "node_modules/convex-auth"), {
      recursive: true,
    });
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ dependencies: { "convex-auth": "0.1.25" } }),
    );
    await writeFile(join(repoRoot, "apps/web/package.json"), JSON.stringify({}));
    await writeFile(
      join(repoRoot, "node_modules/convex-auth/package.json"),
      JSON.stringify({ version: "0.1.25" }),
    );
    await writeFile(
      join(repoRoot, ".test-env"),
      [
        "VITE_BETTER_AUTH_URL=https:/convex-auth.example.test/apiconvex-auth",
        "VITE_CONVEX_URL=https://convex.example.test",
        "CONVEX_SITE_URL=https://convex-site.example.test",
        "PLAYWRIGHT_TEST_BASE_URL=https://app.example.test",
      ].join("\n"),
    );
    await writeFile(
      join(repoRoot, "convex/convex.config.ts"),
      'import convexAuth from "convex-auth/convex.config.js";\napp.use(convexAuth);\n',
    );
    await writeFile(
      join(repoRoot, "convexconvex-auth.config.ts"),
      'import { createConvexAuthConfig } from "convex-auth/better-auth/server";\nexport default { providers: [createConvexAuthConfig()] };\n',
    );
    await writeFile(
      join(repoRoot, "convex/http.ts"),
      'import { httpRouter } from "convex/server";\nimport { registerAuthRoutes } from "./betterAuth";\nconst http = httpRouter();\nregisterAuthRoutes(http);\n',
    );
    await writeFile(
      join(repoRoot, "convex/betterAuth.ts"),
      'import { createBetterAuthConvexRuntime } from "convex-auth/better-auth/convex";\nconst runtime = createBetterAuthConvexRuntime({ components: { betterAuth: components.betterAuth }, refs: { provisionIdentityFromIdentity: components.convexAuth.identity.provisionFromIdentity } });\nexport const registerAuthRoutes = runtime.registerRoutes;\n',
    );

    const lines: string[] = [];
    const exitCode = await runConvexAuthPreflightCommand({
      repoRoot,
      env: {},
      logger: (line) => lines.push(line),
      fetchImpl: async (input) => {
        if (requestUrl(input) === "https://app.example.test/") {
          return new Response(
            "https:/convex-auth.example.test/apiconvex-auth\nhttps://convex.example.test",
            { status: 200 },
          );
        }
        return new Response("ok", { status: 200 });
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(
      lines.some((line) => line.includes("[ERROR] Better Auth trusted origins")),
      true,
    );
  });

  it("fails auth preflight command when backend setup is missing", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "convex-auth-preflight-missing-"));
    await mkdir(join(repoRoot, "apps/web"), { recursive: true });
    await mkdir(join(repoRoot, "node_modules/convex-auth"), {
      recursive: true,
    });
    await writeFile(
      join(repoRoot, "package.json"),
      JSON.stringify({ dependencies: { "convex-auth": "0.1.25" } }),
    );
    await writeFile(join(repoRoot, "apps/web/package.json"), JSON.stringify({}));
    await writeFile(
      join(repoRoot, "node_modules/convex-auth/package.json"),
      JSON.stringify({ version: "0.1.25" }),
    );
    await writeFile(
      join(repoRoot, ".test-env"),
      [
        "VITE_BETTER_AUTH_URL=https:/convex-auth.example.test/apiconvex-auth",
        "VITE_CONVEX_URL=https://convex.example.test",
      ].join("\n"),
    );

    const lines: string[] = [];
    const exitCode = await runConvexAuthPreflightCommand({
      repoRoot,
      env: {},
      logger: (line) => lines.push(line),
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });

    assert.equal(exitCode, 1);
    assert.equal(
      lines.some((line) => line.includes("[ERROR] Convex Auth component registration")),
      true,
    );
    assert.equal(
      lines.some((line) => line.includes("[ERROR] Backend Better Auth site URL")),
      true,
    );
  });

  it("signs in through Better Auth email password UI defaults", async () => {
    const page = new SignInPage();

    await signInWithConvexAuthEmailPassword(page, {
      credentials: {
        email: "person@example.com",
        password: "secret",
      },
    });

    assert.equal(page.clickedSubmit, true);
    assert.equal(
      page.values.get('input[type="email"], input[name="identifier"], input[name="emailAddress"]'),
      "person@example.com",
    );
    assert.equal(page.values.get('input[type="password"]'), "secret");
    assert.equal(new URL(page.url()).pathname, "/app");
  });
});
