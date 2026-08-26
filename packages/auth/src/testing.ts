import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
export {
  proveConvexJwtTrust,
  type ConvexJwtTrustProofResult,
} from "../../better-auth/src/server/proveConvexJwtTrust";
import { resolveBetterAuthTrustedOrigins } from "../../better-auth/src/convex";
import {
  formatAuthPreflightResult,
  runAuthPreflight,
  type AuthPreflightCheck,
} from "./preflight";

const DEFAULT_CONVEX_RUNTIME_TIMEOUT_MS = 15000;
const DEFAULT_AUTH_RUNTIME_TIMEOUT_MS = 15000;
const DEFAULT_CONVEX_AUTH_TOKEN_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_TEST_BASE_URL = "http://127.0.0.1:4173";
const DEFAULT_PACKAGE_NAME = "convex-auth";
const DEFAULT_SIGN_IN_PATH = "/sign-in";
const DEFAULT_SIGN_IN_URL_PATTERN = /\/sign-in(?:\/|$|\?)/;
const DEFAULT_EMAIL_INPUT_SELECTOR =
  'input[type="email"], input[name="identifier"], input[name="emailAddress"]';
const DEFAULT_PASSWORD_INPUT_SELECTOR = 'input[type="password"]';
const DEFAULT_SIGN_IN_BUTTON_NAME = /continue|sign in/i;

export type ConvexAuthTestingPage = {
  evaluate<T, TArg>(
    pageFunction: (arg: TArg) => T | Promise<T>,
    arg: TArg
  ): Promise<T>;
};

export type ConvexAuthTestingLocator = {
  first(): ConvexAuthTestingLocator;
  fill(value: string): Promise<void>;
  click(): Promise<void>;
};

export type ConvexAuthTestingPageWithUi = {
  goto(
    url: string,
    options?: {
      waitUntil?: "commit" | "domcontentloaded" | "load" | "networkidle";
    }
  ): Promise<unknown>;
  getByRole(
    role: "button",
    options: { name: string | RegExp }
  ): ConvexAuthTestingLocator;
  locator(selector: string): ConvexAuthTestingLocator;
  url(): string;
  waitForSelector(
    selector: string,
    options?: { timeout?: number }
  ): Promise<unknown>;
  waitForURL(
    url: string | RegExp,
    options?: {
      timeout?: number;
      waitUntil?: "commit" | "domcontentloaded" | "load" | "networkidle";
    }
  ): Promise<unknown>;
};

export type WaitForExposedConvexRuntimeOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export type WaitForExposedAuthRuntimeOptions =
  WaitForExposedConvexRuntimeOptions;

export type ReadConvexAuthTokenOptions = WaitForExposedConvexRuntimeOptions & {
  forceRefreshToken?: boolean;
};

export type CreateAuthenticatedConvexHttpClientOptions =
  ReadConvexAuthTokenOptions & {
    convexUrl?: string;
    convexUrlEnvName?: string;
  };

export type ConvexAuthTestingEnv = Record<string, string | undefined>;

export type ConvexAuthTestCredentials = {
  email: string;
  password: string;
};

export type ConvexAuthTestCredentialsOptions = {
  env?: ConvexAuthTestingEnv;
  emailEnvName?: string;
  passwordEnvName?: string;
};

export type ConvexAuthE2EEnvironmentOptions =
  ConvexAuthTestCredentialsOptions & {
    scope?: string;
    baseUrlEnvName?: string;
    defaultBaseUrl?: string;
    convexUrlEnvName?: string;
    logger?: (message: string) => void;
  };

export type ConvexAuthPreflightCommandOptions = {
  repoRoot: string;
  backendSetup?: false | ConvexAuthPreflightBackendSetupOptions;
  commandArgs?: string[];
  env?: NodeJS.ProcessEnv;
  logger?: (message: string) => void;
  fetchImpl?: typeof fetch;
  packageName?: string;
  testEnvPath?: string;
  rootPackageJsonPath?: string;
  webPackageJsonPath?: string;
  installedPackageJsonPath?: string;
  betterAuthUrlEnvNames?: string[];
  convexUrlEnvNames?: string[];
  appBaseUrlEnvNames?: string[];
  appServerProbePaths?: string[];
};

export type ConvexAuthPreflightBackendSetupOptions = {
  authConfigPath?: string;
  betterAuthRuntimePath?: string;
  convexConfigPath?: string;
  httpPath?: string;
};

export type SignInWithConvexAuthEmailPasswordOptions =
  ConvexAuthTestCredentialsOptions & {
    afterSignInPathPattern?: RegExp;
    credentials?: ConvexAuthTestCredentials;
    emailInputSelector?: string;
    passwordInputSelector?: string;
    readFailureMessage?: (
      page: ConvexAuthTestingPageWithUi
    ) => Promise<string | null>;
    signInButtonName?: string | RegExp;
    signInPath?: string;
    signInUrlPattern?: RegExp;
    timeoutMs?: number;
  };

type ConvexAuthBrowserRuntime = {
  __authRuntime?: {
    getConvexToken?: (args?: {
      forceRefreshToken?: boolean;
    }) => Promise<string | null>;
  };
  __convexApi?: unknown;
  __convexClient?: unknown;
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  version?: string;
};

let hasLoggedE2EEnvironment = false;

export function hasConvexAuthTestCredentials(
  options: ConvexAuthTestCredentialsOptions = {}
) {
  const env = options.env ?? process.env;
  const emailEnvName = options.emailEnvName ?? "TEST_USER_EMAIL";
  const passwordEnvName = options.passwordEnvName ?? "TEST_USER_PASSWORD";

  return Boolean(env[emailEnvName]?.trim() && env[passwordEnvName]?.trim());
}

export function getConvexAuthTestCredentials(
  options: ConvexAuthTestCredentialsOptions = {}
): ConvexAuthTestCredentials {
  const env = options.env ?? process.env;
  const emailEnvName = options.emailEnvName ?? "TEST_USER_EMAIL";
  const passwordEnvName = options.passwordEnvName ?? "TEST_USER_PASSWORD";
  const email = env[emailEnvName]?.trim();
  const password = env[passwordEnvName]?.trim();

  if (!email || !password) {
    throw new Error(
      `${emailEnvName} and ${passwordEnvName} must be set for auth E2E tests.`
    );
  }

  return { email, password };
}

export function assertConvexAuthAppEnv(
  options: ConvexAuthE2EEnvironmentOptions = {}
) {
  const env = options.env ?? process.env;
  const baseUrlEnvName = options.baseUrlEnvName ?? "PLAYWRIGHT_TEST_BASE_URL";
  const baseUrl =
    env[baseUrlEnvName]?.trim() ||
    options.defaultBaseUrl ||
    DEFAULT_TEST_BASE_URL;

  if (!baseUrl.trim()) {
    throw new Error(`[E2E preflight] Missing ${baseUrlEnvName} for app setup`);
  }

  logConvexAuthE2EEnvironment({
    ...options,
    env,
    scope: options.scope ?? "app",
  });
}

export function assertConvexAuthCredentialsEnv(
  options: ConvexAuthE2EEnvironmentOptions = {}
) {
  getConvexAuthTestCredentials(options);
  logConvexAuthE2EEnvironment({
    ...options,
    scope: options.scope ?? "auth",
  });
}

export function logConvexAuthE2EEnvironment(
  options: ConvexAuthE2EEnvironmentOptions = {}
) {
  if (hasLoggedE2EEnvironment) {
    return;
  }

  const environment = resolveConvexAuthE2EEnvironment(options);
  const logger = options.logger ?? console.info;

  logger(`[setup:${environment.scope}] Base URL: ${environment.baseUrl}`);
  logger(`[setup:${environment.scope}] Convex URL: ${environment.convexUrl}`);
  logger(
    `[setup:${environment.scope}] Auth test user: ${environment.authEmail}`
  );

  hasLoggedE2EEnvironment = true;
}

function resolveConvexAuthE2EEnvironment(
  options: ConvexAuthE2EEnvironmentOptions
) {
  const env = options.env ?? process.env;
  const scope = options.scope ?? "app";
  const baseUrlEnvName = options.baseUrlEnvName ?? "PLAYWRIGHT_TEST_BASE_URL";
  const emailEnvName = options.emailEnvName ?? "TEST_USER_EMAIL";
  const convexUrlEnvName = options.convexUrlEnvName ?? "VITE_CONVEX_URL";
  const baseUrl =
    env[baseUrlEnvName]?.trim() ||
    options.defaultBaseUrl ||
    DEFAULT_TEST_BASE_URL;
  const authEmail = env[emailEnvName]?.trim() || "<missing>";
  const convexUrl = env[convexUrlEnvName]?.trim() || "<missing>";
  return { authEmail, baseUrl, convexUrl, scope };
}

async function loadTestEnvIntoProcessEnv(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  testEnvPath?: string
): Promise<void> {
  const resolvedPath = testEnvPath ?? resolve(repoRoot, ".test-env");
  if (!existsSync(resolvedPath)) {
    return;
  }
  const testEnv = await readEnvFile(resolvedPath);
  for (const [key, value] of Object.entries(testEnv)) {
    env[key] ??= value;
  }
}

function expectedPreflightPackageVersion(
  packageName: string,
  rootPackageJson: PackageJson,
  webPackageJson: PackageJson
): string | null {
  return (
    webPackageJson.dependencies?.[packageName] ??
    webPackageJson.devDependencies?.[packageName] ??
    rootPackageJson.dependencies?.[packageName] ??
    rootPackageJson.devDependencies?.[packageName] ??
    null
  );
}

function resolvePreflightUrls(
  env: NodeJS.ProcessEnv,
  options: ConvexAuthPreflightCommandOptions
) {
  return {
    appBaseUrl: firstEnvValue(
      env,
      options.appBaseUrlEnvNames ?? ["PLAYWRIGHT_TEST_BASE_URL", "TEST_WEB_URL"]
    ),
    betterAuthUrl: firstEnvValue(
      env,
      options.betterAuthUrlEnvNames ?? [
        "VITE_BETTER_AUTH_URL",
        "PRODUCTION_BETTER_AUTH_URL",
      ]
    ),
    convexUrl: firstEnvValue(
      env,
      options.convexUrlEnvNames ?? ["VITE_CONVEX_URL", "CONVEX_URL"]
    ),
  };
}

export async function runConvexAuthPreflightCommand(
  options: ConvexAuthPreflightCommandOptions
) {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console.info;
  const packageName = options.packageName ?? DEFAULT_PACKAGE_NAME;

  await loadTestEnvIntoProcessEnv(options.repoRoot, env, options.testEnvPath);

  const rootPackageJson = await readPackageJson(
    options.rootPackageJsonPath ?? resolve(options.repoRoot, "package.json")
  );
  const webPackageJson = await readPackageJson(
    options.webPackageJsonPath ??
      resolve(options.repoRoot, "apps/web/package.json")
  );
  const installedPackageJson = await readPackageJson(
    options.installedPackageJsonPath ??
      resolve(
        options.repoRoot,
        "node_modules",
        ...packageName.split("/"),
        "package.json"
      )
  );

  const expectedPackageVersion = expectedPreflightPackageVersion(
    packageName,
    rootPackageJson,
    webPackageJson
  );
  const { appBaseUrl, betterAuthUrl, convexUrl } = resolvePreflightUrls(
    env,
    options
  );
  const backendSetup =
    options.backendSetup === false
      ? undefined
      : await readBackendSetup(options.repoRoot, env, options.backendSetup);
  const extraChecks =
    options.backendSetup === false
      ? undefined
      : createTrustedOriginsCheck({
          appBaseUrl,
          betterAuthUrl,
          env,
          backendSetup,
        });

  const result = await runAuthPreflight({
    actualPackageVersion: installedPackageJson.version ?? null,
    appServer: {
      baseUrl: appBaseUrl,
      expectedValues: [betterAuthUrl, convexUrl].filter(
        (value): value is string => Boolean(value)
      ),
      probePaths: options.appServerProbePaths,
    },
    backendSetup,
    betterAuthUrl,
    convexUrl,
    expectedPackageVersion,
    fetchImpl: options.fetchImpl,
    extraChecks,
  });

  logger(formatAuthPreflightResult(result));
  if (!result.ok) {
    return 1;
  }

  const commandArgs = options.commandArgs ?? [];
  if (commandArgs.length === 0) {
    return 0;
  }

  return await runCommand(options.repoRoot, env, commandArgs);
}

export async function signInWithConvexAuthEmailPassword(
  page: ConvexAuthTestingPageWithUi,
  options: SignInWithConvexAuthEmailPasswordOptions = {}
) {
  const credentials =
    options.credentials ?? getConvexAuthTestCredentials(options);
  const timeoutMs = options.timeoutMs ?? DEFAULT_AUTH_RUNTIME_TIMEOUT_MS;
  const emailInputSelector =
    options.emailInputSelector ?? DEFAULT_EMAIL_INPUT_SELECTOR;
  const passwordInputSelector =
    options.passwordInputSelector ?? DEFAULT_PASSWORD_INPUT_SELECTOR;

  await page.goto(options.signInPath ?? DEFAULT_SIGN_IN_PATH, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(
    options.signInUrlPattern ?? DEFAULT_SIGN_IN_URL_PATTERN,
    {
      timeout: timeoutMs,
    }
  );
  await page.waitForSelector(emailInputSelector, { timeout: timeoutMs });
  await page.waitForSelector(passwordInputSelector, { timeout: timeoutMs });

  await page.locator(emailInputSelector).first().fill(credentials.email);
  await page.locator(passwordInputSelector).first().fill(credentials.password);
  await page
    .getByRole("button", {
      name: options.signInButtonName ?? DEFAULT_SIGN_IN_BUTTON_NAME,
    })
    .click();

  try {
    await waitForConvexAuthSignedInPath(page, {
      afterSignInPathPattern: options.afterSignInPathPattern,
      timeoutMs,
    });
  } catch (error) {
    const failureMessage = await options.readFailureMessage?.(page);
    const suffix = failureMessage ? `: ${failureMessage}` : "";
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}${suffix}`,
      { cause: error }
    );
  }
}

export async function waitForExposedConvexRuntime(
  page: ConvexAuthTestingPage,
  options: WaitForExposedConvexRuntimeOptions = {}
) {
  await pollUntil(
    async () =>
      await page.evaluate(() => {
        const runtime = window as typeof window & ConvexAuthBrowserRuntime;
        return Boolean(runtime.__convexApi && runtime.__convexClient);
      }, undefined),
    (isReady): isReady is true => isReady,
    {
      timeoutMs: options.timeoutMs ?? DEFAULT_CONVEX_RUNTIME_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      errorMessage:
        "Convex runtime was not exposed before the readiness timeout.",
    }
  );
}

export async function waitForExposedAuthRuntime(
  page: ConvexAuthTestingPage,
  options: WaitForExposedAuthRuntimeOptions = {}
) {
  await pollUntil(
    async () =>
      await page.evaluate(() => {
        const runtime = window as typeof window & ConvexAuthBrowserRuntime;
        return typeof runtime.__authRuntime?.getConvexToken === "function";
      }, undefined),
    (isReady): isReady is true => isReady,
    {
      timeoutMs: options.timeoutMs ?? DEFAULT_AUTH_RUNTIME_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      errorMessage:
        "Auth runtime was not exposed before the readiness timeout.",
    }
  );
}

export async function readConvexAuthToken(
  page: ConvexAuthTestingPage,
  options: ReadConvexAuthTokenOptions = {}
) {
  await waitForExposedConvexRuntime(page, options);
  await waitForExposedAuthRuntime(page, options);

  const token = await pollUntil(
    async () =>
      await page.evaluate(
        async (args) => {
          const runtime = window as typeof window & ConvexAuthBrowserRuntime;
          const tokenOptions =
            args.forceRefreshToken === undefined
              ? undefined
              : { forceRefreshToken: args.forceRefreshToken };
          return (
            (await runtime.__authRuntime?.getConvexToken?.(tokenOptions)) ??
            null
          );
        },
        { forceRefreshToken: options.forceRefreshToken }
      ),
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
    {
      timeoutMs: options.timeoutMs ?? DEFAULT_CONVEX_AUTH_TOKEN_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      errorMessage:
        "Convex auth token was not available before the readiness timeout.",
    }
  );

  return token;
}

export async function waitForAuthenticatedConvexReady(
  page: ConvexAuthTestingPage,
  options: ReadConvexAuthTokenOptions = {}
) {
  return await readConvexAuthToken(page, options);
}

export async function createAuthenticatedConvexHttpClient(
  page: ConvexAuthTestingPage,
  options: CreateAuthenticatedConvexHttpClientOptions = {}
) {
  const convexUrl = getRequiredConvexUrl(options);
  const token = await readConvexAuthToken(page, options);
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

function getRequiredConvexUrl(
  options: CreateAuthenticatedConvexHttpClientOptions
) {
  const envName = options.convexUrlEnvName ?? "VITE_CONVEX_URL";
  const convexUrl = options.convexUrl ?? process.env[envName]?.trim();
  if (!convexUrl) {
    throw new Error(
      `${envName} is required for authenticated Convex E2E helpers.`
    );
  }

  return convexUrl;
}

// ---------------------------------------------------------------------------
// Form-free, HEADLESS session minting for test clients.
//
// `createAuthenticatedConvexHttpClient` above reads the Convex token from a
// signed-in BROWSER page — it still needs the login form. These helpers skip the
// browser entirely: they hit the consumer-mounted `createTestSessionHandler`
// endpoint (Increment 6a) with the shared secret, then exchange the resulting
// Better-Auth session for a Convex JWT via `@convex-dev/better-auth`'s
// `/api/auth/convex/token` endpoint. Result: an authenticated Convex client for
// headless/backend test suites with zero browser and zero form.
// ---------------------------------------------------------------------------

export type MintConvexAuthTestSessionOptions = {
  /** Convex SITE url hosting the endpoint + `/api/auth` (e.g. `https://calm-x.convex.site`). */
  siteUrl: string;
  /** Shared secret matching the deployment's `VORTEX_AUTH_TEST_SESSION_SECRET`. */
  secret: string;
  email: string;
  password: string;
  /** Path the consumer mounted `createTestSessionHandler` on. Default `/test-session`. */
  testSessionPath?: string;
  /** Better-Auth base path. Default `/api/auth`. */
  basePath?: string;
  /** Header carrying the secret. Default `x-convex-test-secret`. */
  secretHeaderName?: string;
  /** Override fetch (tests). Default `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
};

export type ConvexAuthMintedTestSession = {
  /** The Convex JWT — feed to `ConvexHttpClient.setAuth()`. */
  convexToken: string;
  /** The replayed `Cookie` header for the session, when cookie-based. */
  cookie?: string;
  /** The bearer session token, when the deployment returns one (`set-auth-token`). */
  sessionToken?: string;
};

export async function mintConvexAuthTestSession(
  options: MintConvexAuthTestSessionOptions
): Promise<ConvexAuthMintedTestSession> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "mintConvexAuthTestSession: no fetch implementation available."
    );
  }
  const siteUrl = options.siteUrl.replace(/\/$/, "");
  const testSessionPath = options.testSessionPath ?? "/test-session";
  const basePath = options.basePath ?? "/api/auth";
  const secretHeaderName = options.secretHeaderName ?? "x-convex-test-secret";

  // 1. Mint the session through the secret-guarded endpoint (forwards a
  //    server-side sign-in to Better-Auth).
  const signInResponse = await fetchImpl(`${siteUrl}${testSessionPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [secretHeaderName]: options.secret,
    },
    body: JSON.stringify({ email: options.email, password: options.password }),
  });
  if (!signInResponse.ok) {
    throw new Error(
      `mintConvexAuthTestSession: test-session mint failed (${signInResponse.status} ${signInResponse.statusText}). ` +
        "Confirm VORTEX_AUTH_TEST_SESSIONS=enabled, the secret matches, and the user exists."
    );
  }
  const cookie = extractSessionCookieHeader(signInResponse);
  const sessionToken =
    signInResponse.headers.get("set-auth-token") ?? undefined;
  if (!cookie && !sessionToken) {
    throw new Error(
      "mintConvexAuthTestSession: sign-in succeeded but returned no session (no Set-Cookie / set-auth-token)."
    );
  }

  // 2. Exchange the session for a Convex JWT (@convex-dev/better-auth /convex/token).
  const tokenResponse = await fetchImpl(`${siteUrl}${basePath}/convex/token`, {
    method: "GET",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `mintConvexAuthTestSession: convex token exchange failed (${tokenResponse.status} ${tokenResponse.statusText}).`
    );
  }
  const payload: unknown = await tokenResponse.json();
  const token =
    typeof payload === "object" && payload !== null
      ? Reflect.get(payload, "token")
      : undefined;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(
      "mintConvexAuthTestSession: /api/auth/convex/token returned no token."
    );
  }

  return { convexToken: token, cookie, sessionToken };
}

/**
 * Build a Convex HTTP client authenticated by a minted test session — no browser,
 * no form. `convexUrl` falls back to `VITE_CONVEX_URL` (override via
 * `convexUrlEnvName`).
 */
export async function createTestSessionConvexHttpClient(
  options: MintConvexAuthTestSessionOptions & {
    convexUrl?: string;
    convexUrlEnvName?: string;
  }
): Promise<ConvexHttpClient> {
  const session = await mintConvexAuthTestSession(options);
  const convexUrl = getRequiredConvexUrl(options);
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(session.convexToken);
  return client;
}

/** Build a single `Cookie` request header from a response's `Set-Cookie`(s). */
function extractSessionCookieHeader(response: Response): string | undefined {
  const headers = response.headers;
  const setCookieHeader = headers.get("set-cookie");
  const rawCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : setCookieHeader
        ? [setCookieHeader]
        : [];
  const pairs = rawCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair && pair.includes("=")));
  return pairs.length > 0 ? pairs.join("; ") : undefined;
}

async function waitForConvexAuthSignedInPath(
  page: ConvexAuthTestingPageWithUi,
  options: {
    afterSignInPathPattern?: RegExp;
    timeoutMs: number;
  }
) {
  const afterSignInPathPattern = options.afterSignInPathPattern;
  await pollUntil(
    async () => {
      const pathname = new URL(page.url()).pathname;
      if (afterSignInPathPattern) {
        return afterSignInPathPattern.test(pathname);
      }

      return pathname !== "/sign-in" && pathname !== "/sign-up";
    },
    (isReady): isReady is true => isReady,
    {
      timeoutMs: options.timeoutMs,
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      errorMessage:
        "Sign-in did not leave the auth route before the readiness timeout.",
    }
  );
}

async function readEnvFile(path: string) {
  const content = await readFile(path, "utf8");
  const values: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    values[trimmed.slice(0, separatorIndex)] = trimmed.slice(
      separatorIndex + 1
    );
  }

  return values;
}

async function readBackendSetup(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  options: ConvexAuthPreflightBackendSetupOptions = {}
) {
  const convexConfigPath =
    options.convexConfigPath ?? "convex/convex.config.ts";
  const authConfigPath = options.authConfigPath ?? "convex/auth.config.ts";
  const httpPath = options.httpPath ?? "convex/http.ts";
  const betterAuthRuntimePath =
    options.betterAuthRuntimePath ?? "convex/betterAuth.ts";

  return {
    files: [
      {
        name: "Convex Auth component registration",
        path: convexConfigPath,
        content: await readOptionalText(resolve(repoRoot, convexConfigPath)),
        requiredSnippets: ["convex-auth/convex.config", "app.use"],
      },
      {
        name: "Convex auth config",
        path: authConfigPath,
        content: await readOptionalText(resolve(repoRoot, authConfigPath)),
        requiredSnippets: ["createConvexAuthConfig", "providers"],
      },
      {
        name: "Convex HTTP auth routes",
        path: httpPath,
        content: await readOptionalText(resolve(repoRoot, httpPath)),
        requiredSnippets: ["httpRouter", "registerAuthRoutes"],
      },
      {
        name: "Better Auth Convex runtime",
        path: betterAuthRuntimePath,
        content: await readOptionalText(
          resolve(repoRoot, betterAuthRuntimePath)
        ),
        requiredSnippets: [
          "createBetterAuthConvexRuntime",
          "components.convexAuth",
          "registerRoutes",
        ],
      },
    ],
    envGroups: [
      {
        name: "Backend Better Auth site URL",
        envNames: ["CONVEX_SITE_URL", "BETTER_AUTH_URL"],
        values: env,
      },
    ],
  };
}

function createTrustedOriginsCheck(args: {
  appBaseUrl: string | undefined;
  betterAuthUrl: string | undefined;
  env: NodeJS.ProcessEnv;
  backendSetup: Awaited<ReturnType<typeof readBackendSetup>> | undefined;
}): AuthPreflightCheck[] {
  const appOrigin = readOrigin(args.appBaseUrl);
  if (appOrigin === null) {
    return [
      {
        name: "Better Auth trusted origins",
        severity: "warning",
        ok: false,
        message:
          "app base URL is missing or invalid; trusted-origin proof skipped.",
      },
    ];
  }

  const betterAuthOrigin = readOrigin(args.betterAuthUrl);
  const siteOrigin = readOrigin(
    firstEnvValue(args.env, ["CONVEX_SITE_URL", "BETTER_AUTH_URL"])
  );
  if (appOrigin === betterAuthOrigin || appOrigin === siteOrigin) {
    return [
      {
        name: "Better Auth trusted origins",
        severity: "info",
        ok: true,
        message: `${appOrigin} is same-origin with auth runtime.`,
      },
    ];
  }

  const configuredAppOrigin = readOrigin(
    firstEnvValue(args.env, ["APP_ORIGIN", "VITE_APP_ORIGIN"])
  );
  const trustedOrigins = new Set(
    resolveBetterAuthTrustedOrigins({
      envValue: args.env.BETTER_AUTH_TRUSTED_ORIGINS,
      origins: [siteOrigin, configuredAppOrigin].filter(
        (value): value is string => value !== null
      ),
    })
  );
  const runtimeFile = args.backendSetup?.files?.find(
    (file) => file.name === "Better Auth Convex runtime"
  );
  const runtimeExplicitlyAllowsOrigin =
    runtimeFile?.content?.includes(`"${appOrigin}"`) === true;

  return trustedOrigins.has(appOrigin) || runtimeExplicitlyAllowsOrigin
    ? [
        {
          name: "Better Auth trusted origins",
          severity: "info",
          ok: true,
          message: runtimeExplicitlyAllowsOrigin
            ? `${appOrigin} is allowed by explicit trustedOrigins runtime config.`
            : `${appOrigin} is allowed by APP_ORIGIN/BETTER_AUTH_TRUSTED_ORIGINS.`,
        },
      ]
    : [
        {
          name: "Better Auth trusted origins",
          severity: "error",
          ok: false,
          message: `${appOrigin} is not same-origin with auth runtime and is missing from explicit trustedOrigins runtime config and APP_ORIGIN/BETTER_AUTH_TRUSTED_ORIGINS.`,
        },
      ];
}

function readOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

async function readOptionalText(path: string) {
  if (!existsSync(path)) {
    return null;
  }

  return await readFile(path, "utf8");
}

async function readPackageJson(path: string): Promise<PackageJson> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${path} to contain a JSON object`);
  }
  return {
    dependencies: readStringRecord(Reflect.get(value, "dependencies")),
    devDependencies: readStringRecord(Reflect.get(value, "devDependencies")),
    version:
      typeof Reflect.get(value, "version") === "string"
        ? Reflect.get(value, "version")
        : undefined,
  };
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  return entries.every((entry) => typeof entry[1] === "string")
    ? Object.fromEntries(entries)
    : undefined;
}

async function runCommand(
  repoRoot: string,
  env: NodeJS.ProcessEnv,
  commandArgs: string[]
) {
  const [command, ...args] = commandArgs;
  if (!command) {
    return 0;
  }

  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });

  return await new Promise<number>((resolveExitCode) => {
    child.on("close", (code) => {
      resolveExitCode(code ?? 1);
    });
  });
}

function firstEnvValue(env: ConvexAuthTestingEnv, names: string[]) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

async function pollUntil<T, TAccepted extends T>(
  read: () => Promise<T>,
  accept: (value: T) => value is TAccepted,
  options: {
    timeoutMs: number;
    pollIntervalMs: number;
    errorMessage: string;
  }
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= options.timeoutMs) {
    const value = await read();
    if (accept(value)) {
      return value;
    }

    await sleep(options.pollIntervalMs);
  }

  throw new Error(options.errorMessage);
}

function sleep(durationMs: number) {
  return new Promise((fulfill) => {
    setTimeout(fulfill, durationMs);
  });
}
