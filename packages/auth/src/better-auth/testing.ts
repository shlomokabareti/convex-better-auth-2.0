import { ConvexHttpClient } from "convex/browser";

import {
  firstEnvValue,
  readOrigin,
  runConvexAuthPreflightCommand,
  waitForExposedConvexRuntime,
  type ConvexAuthPreflightBackendSetup,
  type ConvexAuthPreflightCommandOptions,
  type ConvexAuthTestingPage,
  type WaitForExposedConvexRuntimeOptions,
} from "../testing.js";
import { type AuthPreflightCheck } from "../preflight.js";

export { proveConvexJwtTrust, type ConvexJwtTrustProofResult } from "convex-better-auth/server";
import { resolveBetterAuthTrustedOrigins } from "convex-better-auth/convex";

export type WaitForExposedAuthRuntimeOptions = WaitForExposedConvexRuntimeOptions;

export type ConvexAuthBrowserRuntime = {
  __authRuntime?: {
    getConvexToken?: (args?: { forceRefreshToken?: boolean }) => Promise<string | null>;
  };
  __convexApi?: unknown;
  __convexClient?: unknown;
};

export type ReadConvexAuthTokenOptions = WaitForExposedConvexRuntimeOptions & {
  forceRefreshToken?: boolean;
};

export type CreateAuthenticatedConvexHttpClientOptions = ReadConvexAuthTokenOptions & {
  convexUrl?: string;
  convexUrlEnvName?: string;
};

export async function waitForExposedAuthRuntime(
  page: ConvexAuthTestingPage,
  options: WaitForExposedAuthRuntimeOptions = {},
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
      errorMessage: "Auth runtime was not exposed before the readiness timeout.",
    },
  );
}

export async function readConvexAuthToken(
  page: ConvexAuthTestingPage,
  options: ReadConvexAuthTokenOptions = {},
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
          return (await runtime.__authRuntime?.getConvexToken?.(tokenOptions)) ?? null;
        },
        { forceRefreshToken: options.forceRefreshToken },
      ),
    (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
    {
      timeoutMs: options.timeoutMs ?? DEFAULT_CONVEX_AUTH_TOKEN_TIMEOUT_MS,
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      errorMessage: "Convex auth token was not available before the readiness timeout.",
    },
  );

  return token;
}

export async function waitForAuthenticatedConvexReady(
  page: ConvexAuthTestingPage,
  options: ReadConvexAuthTokenOptions = {},
) {
  return await readConvexAuthToken(page, options);
}

export async function createAuthenticatedConvexHttpClient(
  page: ConvexAuthTestingPage,
  options: CreateAuthenticatedConvexHttpClientOptions = {},
) {
  const convexUrl = getRequiredConvexUrl(options);
  const token = await readConvexAuthToken(page, options);
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

function getRequiredConvexUrl(options: CreateAuthenticatedConvexHttpClientOptions) {
  const envName = options.convexUrlEnvName ?? "VITE_CONVEX_URL";
  const convexUrl = options.convexUrl ?? process.env[envName]?.trim();
  if (!convexUrl) {
    throw new Error(`${envName} is required for authenticated Convex E2E helpers.`);
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
// Better-Auth session for a Convex JWT via `convex-better-auth-adapter`'s
// `/api/auth/convex/token` endpoint. Result: an authenticated Convex client for
// headless/backend test suites with zero browser and zero form.
// ---------------------------------------------------------------------------

export type MintConvexAuthTestSessionOptions = {
  /** Convex SITE url hosting the endpoint + `/api/auth` (e.g. `https://calm-x.convex.site`). */
  siteUrl: string;
  /** Shared secret matching the deployment's `CONVEX_AUTH_TEST_SESSION_SECRET`. */
  secret: string;
  email: string;
  password: string;
  /** Path the consumer mounted `createTestSessionHandler` on. Default `/test-session`. */
  testSessionPath?: string;
  /** Better-Auth base path. Default `/api/auth`. */
  basePath?: string;
  /** Header carrying the secret. Default `x-convex-auth-test-secret`. */
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
  options: MintConvexAuthTestSessionOptions,
): Promise<ConvexAuthMintedTestSession> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("mintConvexAuthTestSession: no fetch implementation available.");
  }
  const siteUrl = options.siteUrl.replace(/\/$/, "");
  const testSessionPath = options.testSessionPath ?? "/test-session";
  const basePath = options.basePath ?? "/api/auth";
  const secretHeaderName = options.secretHeaderName ?? "x-convex-auth-test-secret";

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
        "Confirm CONVEX_AUTH_TEST_SESSIONS=enabled, the secret matches, and the user exists.",
    );
  }
  const cookie = extractSessionCookieHeader(signInResponse);
  const sessionToken = signInResponse.headers.get("set-auth-token") ?? undefined;
  if (!cookie && !sessionToken) {
    throw new Error(
      "mintConvexAuthTestSession: sign-in succeeded but returned no session (no Set-Cookie / set-auth-token).",
    );
  }

  // 2. Exchange the session for a Convex JWT (convex-better-auth-adapter /convex/token).
  const tokenResponse = await fetchImpl(`${siteUrl}${basePath}/convex/token`, {
    method: "GET",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `mintConvexAuthTestSession: convex token exchange failed (${tokenResponse.status} ${tokenResponse.statusText}).`,
    );
  }
  const payload: unknown = await tokenResponse.json();
  const token =
    typeof payload === "object" && payload !== null ? Reflect.get(payload, "token") : undefined;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("mintConvexAuthTestSession: /api/auth/convex/token returned no token.");
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
  },
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

export function createTrustedOriginsCheck(args: {
  appBaseUrl: string | undefined;
  betterAuthUrl: string | undefined;
  env: NodeJS.ProcessEnv;
  backendSetup: ConvexAuthPreflightBackendSetup | undefined;
}): AuthPreflightCheck[] {
  const appOrigin = readOrigin(args.appBaseUrl);
  if (appOrigin === null) {
    return [
      {
        name: "Better Auth trusted origins",
        severity: "warning",
        ok: false,
        message: "app base URL is missing or invalid; trusted-origin proof skipped.",
      },
    ];
  }

  const betterAuthOrigin = readOrigin(args.betterAuthUrl);
  const siteOrigin = readOrigin(firstEnvValue(args.env, ["CONVEX_SITE_URL", "BETTER_AUTH_URL"]));
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
    firstEnvValue(args.env, ["APP_ORIGIN", "VITE_APP_ORIGIN"]),
  );
  const trustedOrigins = new Set(
    resolveBetterAuthTrustedOrigins({
      envValue: args.env.BETTER_AUTH_TRUSTED_ORIGINS,
      origins: [siteOrigin, configuredAppOrigin].filter((value): value is string => value !== null),
    }),
  );
  const runtimeFile = args.backendSetup?.files?.find(
    (file) => file.name === "Better Auth Convex runtime",
  );
  const runtimeExplicitlyAllowsOrigin = runtimeFile?.content?.includes(`"${appOrigin}"`) === true;

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

export async function runBetterAuthPreflightCommand(
  options: ConvexAuthPreflightCommandOptions,
): Promise<number> {
  return await runConvexAuthPreflightCommand({
    ...options,
    extraCheckFactory: (args) =>
      createTrustedOriginsCheck({
        appBaseUrl: args.appBaseUrl,
        betterAuthUrl: args.betterAuthUrl,
        env: args.env,
        backendSetup: args.backendSetup,
      }),
  });
}

const DEFAULT_AUTH_RUNTIME_TIMEOUT_MS = 15000;
const DEFAULT_CONVEX_AUTH_TOKEN_TIMEOUT_MS = 30000;
const DEFAULT_POLL_INTERVAL_MS = 100;

async function pollUntil<T, TAccepted extends T>(
  read: () => Promise<T>,
  accept: (value: T) => value is TAccepted,
  options: {
    timeoutMs: number;
    pollIntervalMs: number;
    errorMessage: string;
  },
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
