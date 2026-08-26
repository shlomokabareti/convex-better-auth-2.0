import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import type { BetterAuthOptions } from "better-auth";
import type {
  FunctionReference,
  FunctionVisibility,
  GenericDataModel,
  HttpRouter,
} from "convex/server";

import type { BetterAuthIdentityProvisionPayload } from "./bridge/createBetterAuthIdentityProvisionPayload";
import { resolveOptionalBetterAuthIdentityIssuer } from "./bridge/identityKeys";
import type { BetterAuthConvexAuthProvider } from "./server/createConvexAuthConfig";

export {
  createTestSessionHandler,
  type CreateTestSessionHandlerConfig,
} from "./createTestSessionHandler";

export {
  createAuthServiceSessionMinter,
  type CreateAuthServiceSessionMinterConfig,
  type ServiceSessionMintRequest,
  type ServiceSessionResult,
  type ServiceSessionMintAudit,
} from "./createServiceSessionMinter";

export type BetterAuthComponentApi<DataModel extends GenericDataModel> = Parameters<
  typeof createClient<DataModel>
>[0];

export type BetterAuthConvexUserSyncArgs = {
  betterAuthUserId: string;
  email: string;
  emailVerified: boolean;
  issuer: string;
  name?: string;
  image?: string;
  sessionId?: string;
};

export type BetterAuthConvexIdentityProvisionArgs = BetterAuthIdentityProvisionPayload;

export type BetterAuthConvexRuntimeRefs = {
  upsertUserFromBetterAuth?: FunctionReference<
    "mutation",
    FunctionVisibility,
    BetterAuthConvexUserSyncArgs,
    unknown
  >;
  provisionIdentityFromIdentity?: FunctionReference<
    "mutation",
    FunctionVisibility,
    BetterAuthConvexIdentityProvisionArgs,
    unknown
  >;
  deleteUserFromBetterAuth?: FunctionReference<
    "mutation",
    FunctionVisibility,
    { betterAuthUserId: string },
    unknown
  >;
  /**
   * Convex-native rate-limit gate for state-changing auth requests
   * (sign-up / sign-in). Better Auth's built-in limiter is a no-op on
   * Convex (in-memory storage; serverless has no shared memory), so the
   * consumer wires this to a real distributed limiter
   * (@convex-dev/rate-limiter). Returns ok:false to reject with 429.
   */
  rateLimitAuthRequest?: FunctionReference<
    "mutation",
    FunctionVisibility,
    { ip: string; path: string; email?: string; subjectKey?: string },
    { ok: boolean; retryAfterMs?: number }
  >;
};

// The user-sync trigger callbacks. The CONSUMER passes the object this
// returns into their own `createClient(component, { triggers })` call —
// the createClient seam must live in the consumer's convex module so
// Convex codegen + the component's function-handle dispatch resolve
// correctly. (Wrapping createClient inside the package breaks that.)
export type BetterAuthUserSyncTriggerDoc = {
  _id: string;
  email?: unknown;
  name?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  emailVerified?: unknown;
};
export type BetterAuthUserSyncTriggers<DataModel extends GenericDataModel> = {
  user: {
    onCreate: (ctx: GenericCtx<DataModel>, doc: BetterAuthUserSyncTriggerDoc) => Promise<void>;
    onUpdate: (ctx: GenericCtx<DataModel>, newDoc: BetterAuthUserSyncTriggerDoc) => Promise<void>;
    onDelete: (ctx: GenericCtx<DataModel>, doc: { _id: string }) => Promise<void>;
  };
};

export type BetterAuthRateLimitConfig = {
  enabled?: boolean;
  window?: number;
  max?: number;
  storage?: "memory" | "secondary-storage";
};

export type BetterAuthSessionConfig = {
  /** Absolute session lifetime in seconds. */
  expiresIn?: number;
  /** Rolling refresh: once this age (s) is reached, expiry is extended on use. */
  updateAge?: number;
  /** Seconds within which a session counts as "fresh" for sensitive ops. */
  freshAge?: number;
  /** Disable rolling refresh entirely. */
  disableSessionRefresh?: boolean;
  /**
   * Signed-cookie session cache. With this on, the server validates the
   * session from the cookie instead of a DB read on every request
   * (locally verifiable, no per-request round trip).
   * Revocation/expiry still invalidate within `maxAge`.
   */
  cookieCache?: {
    enabled?: boolean;
    maxAge?: number;
  };
};

type BetterAuthDatabaseHooksFactory<DataModel extends GenericDataModel> = (args: {
  ctx: GenericCtx<DataModel>;
  siteUrl: string;
}) => BetterAuthOptions["databaseHooks"];

/**
 * Default session posture: 30-day absolute lifetime with
 * daily rolling refresh, and a 60-second signed-cookie cache so the
 * common path validates locally without hitting Convex. The 60s cache
 * bounds the post-sign-out /
 * post-revocation replay window to <=60s while still removing the
 * per-request DB read for rapid request bursts. `freshAge` is left at
 * Better Auth's default (1 day) — the sensitive-operation freshness
 * check must not be weakened by default.
 */
const DEFAULT_SESSION_CONFIG: BetterAuthSessionConfig = {
  expiresIn: 60 * 60 * 24 * 30,
  updateAge: 60 * 60 * 24,
  cookieCache: {
    enabled: true,
    maxAge: 60,
  },
};

export type BetterAuthConvexRuntimeConfig<DataModel extends GenericDataModel> = {
  components: {
    betterAuth: BetterAuthComponentApi<DataModel>;
  };
  /**
   * The authComponent the CONSUMER created via
   * `createClient(components.betterAuth, { triggers, authFunctions })`.
   * Passing it here keeps the createClient seam (and its triggersApi /
   * authFunctions wiring) in the consumer module where Convex codegen
   * and the component's function-handle dispatch can resolve it. If
   * omitted, the runtime falls back to a triggerless internal client.
   *
   * Typed loosely on purpose: the consumer's `@convex-dev/better-auth`
   * may be a different installed instance than this package's, so a
   * nominal `ReturnType<typeof createClient>` would falsely mismatch.
   */
  authComponent?: BetterAuthComponentLike<DataModel>;
  authProvider: BetterAuthConvexAuthProvider;
  refs?: BetterAuthConvexRuntimeRefs;
  basePath?: string;
  cors?: boolean;
  emailAndPassword?: {
    enabled: boolean;
    minPasswordLength?: number;
    maxPasswordLength?: number;
  };
  /** Better Auth account options passed through by consumers that need them. */
  account?: BetterAuthOptions["account"];
  /**
   * Better Auth database hooks. A factory can close over the request's Convex ctx,
   * matching app-local direct betterAuth(...) wiring without bypassing the shared
   * route handler.
   */
  databaseHooks?: BetterAuthOptions["databaseHooks"] | BetterAuthDatabaseHooksFactory<DataModel>;
  /**
   * Email-verification posture. Wired to Better Auth's
   * `emailVerification` options + `emailAndPassword.requireEmailVerification`.
   * Verification/reset emails only actually send when `sendEmail` (below)
   * is also provided — this block just controls the policy knobs.
   */
  emailVerification?: {
    /** Send a verification email automatically on sign-up. Default false. */
    sendOnSignUp?: boolean;
    /**
     * Block sign-in until the address is verified
     * (maps to emailAndPassword.requireEmailVerification). Default false.
     */
    required?: boolean;
  };
  /**
   * Single email-transport seam. The package owns POLICY (when to send,
   * what kind, the tokenized action URL Better Auth produced); the
   * CONSUMER owns TRANSPORT + RENDERING. This mirrors how the invitation
   * flow splits package-side policy from consumer-side delivery.
   *
   * STYLE A (intentional): the runtime hands the consumer
   * `{kind,to,url,token,userId}` and the consumer decides how to render
   * — they MAY call the Part-1 `convex-auth/convex` draft
   * helpers (createPasswordResetEmailDraft / createEmailVerificationEmailDraft)
   * or use their own template. The runtime never builds the
   * {from,subject,html,text} draft itself, keeping it decoupled from
   * rendering. `url` is already fully tokenized by Better Auth; `token`
   * is provided too for consumers who render their own link.
   *
   * When omitted, no reset/verification callbacks are wired — fully
   * back-compatible (no behavior change).
   */
  sendEmail?: (args: {
    /**
     * Convex generic ctx the Better-Auth handler is running in. Lets
     * consumers reach `@convex-dev/resend`, `ctx.scheduler`, or any
     * other ctx-bound resource at email time without threading it
     * through a closure they themselves capture. Added so consumers
     * can use the canonical Convex storage/resend plumbing instead
     * of fetching the email API directly.
     */
    ctx: GenericCtx<DataModel>;
    kind: "verify-email" | "reset-password";
    to: string;
    url: string;
    token: string;
    userId?: string;
  }) => Promise<void>;
  rateLimit?: BetterAuthRateLimitConfig;
  /**
   * Social sign-on providers (Google/Apple/Microsoft/etc.), passed straight
   * to Better Auth's `socialProviders`. STYLE A (consumer owns secrets): the
   * consumer supplies each provider's `clientId`/`clientSecret` from their own
   * env. The package owns the wiring — the OAuth callback routes are mounted by
   * the Better Auth handler (`/api/auth/callback/<provider>`), and the
   * cross-domain + expo plugins handle web + native redirects. The provider's
   * redirect URI must be registered as `<CONVEX_SITE_URL>/api/auth/callback/<provider>`,
   * and native apps must include their scheme in `trustedOrigins`.
   * Absent (default) → no social providers; back-compatible.
   */
  socialProviders?: BetterAuthOptions["socialProviders"];
  /**
   * Breached-password screening (NIST 800-63B requires checking
   * passwords against known-breached lists). Uses Better Auth's OFFICIAL
   * `haveIBeenPwned` plugin
   * (audited; HIBP k-anonymity — only a 5-char SHA-1 prefix leaves the
   * server, never the password). Runs on sign-up and password
   * set/change/reset. Default enabled. NOTE: the official plugin fails
   * CLOSED — if HIBP is unreachable the request is rejected (no custom
   * fail-open override; this matches Better Auth's own behavior).
   */
  breachedPasswordCheck?: {
    enabled?: boolean;
    message?: string;
  };
  /**
   * Bot/abuse mitigation via Better Auth's OFFICIAL `captcha` plugin
   * (Cloudflare Turnstile; stateless — no DB schema). Default DISABLED;
   * a project opts in by supplying `secretKey`. Deliberately scoped to
   * sign-up + password-reset (the mass-abuse vectors) and NOT sign-in:
   * sign-in is already covered by the Convex-native distributed rate
   * limiter, and gating it would 400 every programmatic/native/MCP
   * caller that cannot present an `x-captcha-response` token.
   */
  captcha?: {
    enabled?: boolean;
    secretKey?: string;
    endpoints?: string[];
  };
  session?: BetterAuthSessionConfig;
  /**
   * TOTP / backup-code MFA via Better Auth's OFFICIAL `twoFactor`
   * plugin (audited crypto; the @convex-dev/better-auth component
   * schema already includes the twoFactor table + twoFactorEnabled
   * field). Opt-in per project — default off. Email-OTP step-up
   * remains a separate secondary/recovery factor.
   */
  twoFactor?: {
    enabled?: boolean;
    issuer?: string;
  };
  /**
   * Request headers to trust for the client IP (rate limiting + session
   * tracking). Convex routes all traffic through its edge, so
   * `x-forwarded-for` is the authoritative client IP. Override only if
   * a different trusted proxy chain is in front.
   */
  ipAddressHeaders?: readonly string[];
  /** Verbose Better Auth logging (default: errors only). */
  verbose?: boolean;
  siteUrlEnvNames?: readonly string[];
  secretEnvName?: string;
  trustedOriginsEnvName?: string;
  trustedOrigins?: readonly string[];
  linkedAccountPageSize?: number;
};

type BetterAuthComponentLike<DataModel extends GenericDataModel> = Pick<
  ReturnType<typeof createClient<DataModel>>,
  "adapter" | "registerRoutesLazy"
>;

export type BetterAuthConvexRuntime<DataModel extends GenericDataModel> = {
  authComponent: BetterAuthComponentLike<DataModel>;
  createAuth: (ctx: GenericCtx<DataModel>) => LazyBetterAuth;
  registerRoutes: (http: HttpRouter) => void;
  resolveTrustedOrigins: (siteUrl: string) => string[];
};

/**
 * The Better-Auth backend context our runtime exposes via `createAuth(ctx).$context`.
 * It is the REAL `betterAuth(...).$context` (a superset of this shape), narrowed to
 * the two things our callers depend on:
 *   - `options.trustedOrigins` — read by @convex-dev/better-auth's CORS router.
 *   - `internalAdapter` — the native session primitive the service-session minter
 *     (createAuthServiceSessionMinter) uses to mint / revoke a session as a
 *     target user, plus the user reads consumers address a target by:
 *       - `findUserById` — reject orphan-session mints.
 *       - `findUserByEmail` — resolve a target by its natural "act as this user"
 *         identifier (the service-session minter takes an email, not an opaque id).
 *       - `listUsers` — admin / agent-as-user read primitive.
 *     These exist on the REAL better-auth `internalAdapter`; this type just stops
 *     consumers from casting through `unknown` to reach them.
 */
type BetterAuthBackendContext = {
  internalAdapter: {
    createSession: (
      userId: string,
      dontRememberMe?: boolean,
      override?: Record<string, unknown>,
      overrideAll?: boolean,
    ) => Promise<{ token: string; expiresAt?: number | Date }>;
    deleteSession: (token: string) => Promise<unknown>;
    findUserById: (userId: string) => Promise<unknown>;
    /**
     * Resolve a user by email. Returns the user plus its linked accounts (empty
     * unless `options.includeAccounts`), or `null` when no user has that email.
     */
    findUserByEmail: (
      email: string,
      options?: { includeAccounts?: boolean },
    ) => Promise<{
      user: { id: string; email: string };
      accounts: unknown[];
    } | null>;
    /** List users (thin passthrough to the adapter's `findMany` over the user model). */
    listUsers: (
      limit?: number,
      offset?: number,
      sortBy?: { field: string; direction: "asc" | "desc" },
      where?: unknown,
    ) => Promise<unknown[]>;
  };
  options: {
    trustedOrigins: string[];
  };
};

type LazyBetterAuth = {
  handler: (request: Request) => Promise<Response>;
  options: {
    baseURL: string;
    basePath: string;
    trustedOrigins: string[];
  };
  $context: Promise<BetterAuthBackendContext>;
};

function parseBetterAuthBackendContext(value: unknown): BetterAuthBackendContext {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Better Auth returned an invalid backend context");
  }
  const internalAdapter = Reflect.get(value, "internalAdapter");
  const options = Reflect.get(value, "options");
  if (
    typeof internalAdapter !== "object" ||
    internalAdapter === null ||
    typeof options !== "object" ||
    options === null
  ) {
    throw new TypeError("Better Auth backend context is missing required fields");
  }
  const trustedOrigins = Reflect.get(options, "trustedOrigins");
  if (
    !Array.isArray(trustedOrigins) ||
    !trustedOrigins.every((origin) => typeof origin === "string")
  ) {
    throw new TypeError("Better Auth trustedOrigins must be strings");
  }
  const call = (name: string, args: unknown[]): unknown => {
    const method = Reflect.get(internalAdapter, name);
    if (typeof method !== "function") {
      throw new TypeError(`Better Auth internalAdapter.${name} is required`);
    }
    return Reflect.apply(method, internalAdapter, args);
  };
  return {
    internalAdapter: {
      createSession: async (...args) => {
        const result: unknown = await call("createSession", args);
        if (typeof result !== "object" || result === null) {
          throw new TypeError("Better Auth createSession returned invalid data");
        }
        const token = Reflect.get(result, "token");
        const expiresAt = Reflect.get(result, "expiresAt");
        if (
          typeof token !== "string" ||
          (expiresAt !== undefined && typeof expiresAt !== "number" && !(expiresAt instanceof Date))
        ) {
          throw new TypeError("Better Auth createSession returned invalid data");
        }
        return { token, ...(expiresAt !== undefined ? { expiresAt } : {}) };
      },
      deleteSession: async (token) => await call("deleteSession", [token]),
      findUserById: async (userId) => await call("findUserById", [userId]),
      findUserByEmail: async (email, lookupOptions) => {
        const result: unknown = await call("findUserByEmail", [email, lookupOptions]);
        if (result === null) return null;
        if (typeof result !== "object" || Array.isArray(result)) {
          throw new TypeError("Better Auth findUserByEmail returned invalid data");
        }
        const user = Reflect.get(result, "user");
        const accounts = Reflect.get(result, "accounts");
        if (typeof user !== "object" || user === null || !Array.isArray(accounts)) {
          throw new TypeError("Better Auth findUserByEmail returned invalid data");
        }
        const id = Reflect.get(user, "id");
        const userEmail = Reflect.get(user, "email");
        if (typeof id !== "string" || typeof userEmail !== "string") {
          throw new TypeError("Better Auth findUserByEmail returned invalid user");
        }
        return { user: { id, email: userEmail }, accounts };
      },
      listUsers: async (...args) => {
        const result: unknown = await call("listUsers", args);
        if (!Array.isArray(result)) {
          throw new TypeError("Better Auth listUsers returned invalid data");
        }
        return result;
      },
    },
    options: { trustedOrigins },
  };
}

type QueryMutationCtx<DataModel extends GenericDataModel> = Extract<
  GenericCtx<DataModel>,
  { runQuery: unknown; runMutation: unknown }
>;

const DEFAULT_BASE_PATH = "/api/auth";
const DEFAULT_SITE_URL_ENV_NAMES = ["CONVEX_SITE_URL", "BETTER_AUTH_URL"] as const;
const DEFAULT_SECRET_ENV_NAME = "BETTER_AUTH_SECRET";
const DEFAULT_TRUSTED_ORIGINS_ENV_NAME = "BETTER_AUTH_TRUSTED_ORIGINS";
const DEFAULT_LINKED_ACCOUNT_PAGE_SIZE = 50;

/**
 * Warn-once latch for the "no rate limiter wired" security gap. Module-scoped so
 * the loud log fires at most once per isolate instead of on every auth POST.
 */
let warnedMissingRateLimit = false;

type BetterAuthRuntimeResolvedConfig<DataModel extends GenericDataModel> = {
  authComponent: BetterAuthComponentLike<DataModel>;
  basePath: string;
  breachCheck: { enabled: boolean; message?: string };
  emailAndPassword: {
    enabled: boolean;
    minPasswordLength?: number;
    maxPasswordLength?: number;
  };
  ipAddressHeaders: readonly string[];
  secretEnvName: string;
  session: BetterAuthSessionConfig;
  siteUrlEnvNames: readonly string[];
  trustedOriginsEnvName: string;
  verbose: boolean;
};

type BetterAuthRuntimeOptions = {
  baseURL: string;
  basePath: string;
  trustedOrigins: string[];
};

type BuiltBetterAuthInstance = {
  handler: (request: Request) => Promise<Response>;
  $context: unknown;
};
type BetterAuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

export function createBetterAuthConvexRuntime<DataModel extends GenericDataModel>(
  config: BetterAuthConvexRuntimeConfig<DataModel>,
): BetterAuthConvexRuntime<DataModel> {
  const resolved = resolveBetterAuthRuntimeConfig(config);
  const resolveTrustedOrigins = (siteUrl: string): string[] =>
    resolveBetterAuthTrustedOrigins({
      envName: resolved.trustedOriginsEnvName,
      origins: [siteUrl, ...(config.trustedOrigins ?? [])],
    });

  const createAuth = (ctx: GenericCtx<DataModel>): LazyBetterAuth =>
    createLazyBetterAuth({ config, ctx, resolved, resolveTrustedOrigins });

  const registerRoutes = (http: HttpRouter): void => {
    const siteUrl = readFirstEnv(resolved.siteUrlEnvNames) ?? "";
    resolved.authComponent.registerRoutesLazy(http, createAuth, {
      basePath: resolved.basePath,
      cors: config.cors ?? true,
      trustedOrigins: resolveTrustedOrigins(siteUrl),
    });
  };

  return {
    authComponent: resolved.authComponent,
    createAuth,
    registerRoutes,
    resolveTrustedOrigins,
  };
}

function resolveBetterAuthRuntimeConfig<DataModel extends GenericDataModel>(
  config: BetterAuthConvexRuntimeConfig<DataModel>,
): BetterAuthRuntimeResolvedConfig<DataModel> {
  return {
    authComponent: config.authComponent ?? createClient<DataModel>(config.components.betterAuth),
    basePath: config.basePath ?? DEFAULT_BASE_PATH,
    breachCheck: {
      enabled: true,
      ...config.breachedPasswordCheck,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      ...config.emailAndPassword,
    },
    ipAddressHeaders: config.ipAddressHeaders ?? ["x-forwarded-for"],
    secretEnvName: config.secretEnvName ?? DEFAULT_SECRET_ENV_NAME,
    session: resolveBetterAuthSessionConfig(config.session),
    siteUrlEnvNames: config.siteUrlEnvNames ?? DEFAULT_SITE_URL_ENV_NAMES,
    trustedOriginsEnvName: config.trustedOriginsEnvName ?? DEFAULT_TRUSTED_ORIGINS_ENV_NAME,
    verbose: config.verbose ?? false,
  };
}

function resolveBetterAuthSessionConfig(session: BetterAuthSessionConfig | undefined) {
  return {
    ...DEFAULT_SESSION_CONFIG,
    ...session,
    cookieCache: {
      ...DEFAULT_SESSION_CONFIG.cookieCache,
      ...session?.cookieCache,
    },
  };
}

function createLazyBetterAuth<DataModel extends GenericDataModel>(args: {
  config: BetterAuthConvexRuntimeConfig<DataModel>;
  ctx: GenericCtx<DataModel>;
  resolved: BetterAuthRuntimeResolvedConfig<DataModel>;
  resolveTrustedOrigins: (siteUrl: string) => string[];
}): LazyBetterAuth {
  const siteUrl = requireFirstEnv(args.resolved.siteUrlEnvNames);
  const options = {
    baseURL: siteUrl,
    basePath: args.resolved.basePath,
    trustedOrigins: args.resolveTrustedOrigins(siteUrl),
  };
  let authInstancePromise: Promise<BuiltBetterAuthInstance> | undefined;
  const getAuthInstance = (): Promise<BuiltBetterAuthInstance> => {
    authInstancePromise ??= buildBetterAuthInstance({
      ...args,
      options,
      siteUrl,
    });
    return authInstancePromise;
  };

  return {
    options,
    get $context(): Promise<BetterAuthBackendContext> {
      return getAuthInstance().then((auth) => parseBetterAuthBackendContext(auth.$context));
    },
    handler: async (request) =>
      handleBetterAuthRequest({
        auth: await getAuthInstance(),
        config: args.config,
        ctx: args.ctx,
        ipAddressHeaders: args.resolved.ipAddressHeaders,
        request,
        verbose: args.resolved.verbose,
      }),
  };
}

async function buildBetterAuthInstance<DataModel extends GenericDataModel>(args: {
  config: BetterAuthConvexRuntimeConfig<DataModel>;
  ctx: GenericCtx<DataModel>;
  options: BetterAuthRuntimeOptions;
  resolved: BetterAuthRuntimeResolvedConfig<DataModel>;
  siteUrl: string;
}): Promise<BuiltBetterAuthInstance> {
  const [{ betterAuth }, { convex, crossDomain }, { twoFactor, haveIBeenPwned, captcha }] =
    await Promise.all([
      import("better-auth/minimal"),
      import("@convex-dev/better-auth/plugins"),
      import("better-auth/plugins"),
    ]);
  const emailDelivery = buildBetterAuthEmailDelivery(args.config, args.ctx);
  const databaseHooks = resolveBetterAuthDatabaseHooks(
    args.config.databaseHooks,
    args.ctx,
    args.siteUrl,
  );

  return betterAuth({
    secret: requireEnv(args.resolved.secretEnvName),
    ...args.options,
    ...(args.config.account !== undefined ? { account: args.config.account } : {}),
    emailAndPassword: {
      ...args.resolved.emailAndPassword,
      ...emailDelivery.emailAndPassword,
    },
    ...(emailDelivery.emailVerification !== undefined
      ? { emailVerification: emailDelivery.emailVerification }
      : {}),
    ...(args.config.socialProviders !== undefined
      ? { socialProviders: args.config.socialProviders }
      : {}),
    session: args.resolved.session,
    advanced: buildBetterAuthAdvancedOptions(args.resolved.ipAddressHeaders),
    logger: { level: args.resolved.verbose ? "debug" : "error" },
    rateLimit: args.config.rateLimit,
    ...(databaseHooks !== undefined ? { databaseHooks } : {}),
    database: args.resolved.authComponent.adapter(args.ctx),
    plugins: [
      ...buildBetterAuthSecurityPlugins({ captcha, haveIBeenPwned, twoFactor }, args),
      crossDomain({ siteUrl: args.siteUrl }),
      convex({
        authConfig: { providers: [args.config.authProvider] },
        options: { basePath: args.resolved.basePath },
      }),
    ],
  });
}

function resolveBetterAuthDatabaseHooks<DataModel extends GenericDataModel>(
  databaseHooks:
    | BetterAuthOptions["databaseHooks"]
    | BetterAuthDatabaseHooksFactory<DataModel>
    | undefined,
  ctx: GenericCtx<DataModel>,
  siteUrl: string,
): BetterAuthOptions["databaseHooks"] | undefined {
  return typeof databaseHooks === "function" ? databaseHooks({ ctx, siteUrl }) : databaseHooks;
}

function buildBetterAuthAdvancedOptions(ipAddressHeaders: readonly string[]) {
  return {
    ipAddress: {
      ipAddressHeaders: [...ipAddressHeaders],
    },
  };
}

function buildBetterAuthSecurityPlugins<DataModel extends GenericDataModel>(
  plugins: {
    captcha: (options: {
      provider: "cloudflare-turnstile";
      secretKey: string;
      endpoints: string[];
    }) => BetterAuthPlugin;
    haveIBeenPwned: (options?: { customPasswordCompromisedMessage?: string }) => BetterAuthPlugin;
    twoFactor: (options?: { issuer?: string }) => BetterAuthPlugin;
  },
  args: {
    config: BetterAuthConvexRuntimeConfig<DataModel>;
    resolved: BetterAuthRuntimeResolvedConfig<DataModel>;
  },
): BetterAuthPlugin[] {
  return [
    ...buildBetterAuthTwoFactorPlugins(plugins.twoFactor, args.config),
    ...buildBetterAuthBreachCheckPlugins(plugins.haveIBeenPwned, args.resolved.breachCheck),
    ...buildBetterAuthCaptchaPlugins(plugins.captcha, args.config),
  ];
}

function buildBetterAuthTwoFactorPlugins<DataModel extends GenericDataModel>(
  twoFactor: (options?: { issuer?: string }) => BetterAuthPlugin,
  config: BetterAuthConvexRuntimeConfig<DataModel>,
): BetterAuthPlugin[] {
  return config.twoFactor?.enabled === true
    ? [twoFactor(config.twoFactor.issuer ? { issuer: config.twoFactor.issuer } : {})]
    : [];
}

function buildBetterAuthBreachCheckPlugins(
  haveIBeenPwned: (options?: { customPasswordCompromisedMessage?: string }) => BetterAuthPlugin,
  breachCheck: { enabled: boolean; message?: string },
): BetterAuthPlugin[] {
  return breachCheck.enabled
    ? [
        haveIBeenPwned(
          breachCheck.message ? { customPasswordCompromisedMessage: breachCheck.message } : {},
        ),
      ]
    : [];
}

function buildBetterAuthCaptchaPlugins<DataModel extends GenericDataModel>(
  captcha: (options: {
    provider: "cloudflare-turnstile";
    secretKey: string;
    endpoints: string[];
  }) => BetterAuthPlugin,
  config: BetterAuthConvexRuntimeConfig<DataModel>,
): BetterAuthPlugin[] {
  if (
    config.captcha?.enabled !== true ||
    typeof config.captcha.secretKey !== "string" ||
    config.captcha.secretKey.length === 0
  ) {
    return [];
  }

  return [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: config.captcha.secretKey,
      endpoints: config.captcha.endpoints ?? ["/sign-up/email", "/request-password-reset"],
    }),
  ];
}

async function handleBetterAuthRequest<DataModel extends GenericDataModel>(args: {
  auth: BuiltBetterAuthInstance;
  config: BetterAuthConvexRuntimeConfig<DataModel>;
  ctx: GenericCtx<DataModel>;
  ipAddressHeaders: readonly string[];
  request: Request;
  verbose: boolean;
}): Promise<Response> {
  const rateLimitResponse = await enforceBetterAuthRateLimit(args);
  if (rateLimitResponse !== undefined) {
    return rateLimitResponse;
  }

  return normalizeBetterAuthHandlerResponse(args.auth, args.request, args.verbose);
}

async function enforceBetterAuthRateLimit<DataModel extends GenericDataModel>(args: {
  config: BetterAuthConvexRuntimeConfig<DataModel>;
  ctx: GenericCtx<DataModel>;
  ipAddressHeaders: readonly string[];
  request: Request;
}): Promise<Response | undefined> {
  const rateLimitRef = args.config.refs?.rateLimitAuthRequest;
  if (rateLimitRef === undefined) {
    logMissingBetterAuthRateLimit(args.request);
    return undefined;
  }
  if (args.request.method !== "POST" || !hasQueryMutation(args.ctx)) {
    return undefined;
  }

  const rateLimitRequest = await buildBetterAuthRateLimitRequest(
    args.request,
    args.ipAddressHeaders,
  );
  if (rateLimitRequest === undefined) {
    return undefined;
  }
  if (rateLimitRequest.blocked) {
    return createRateLimitedResponse(60_000);
  }

  try {
    const verdict = await args.ctx.runMutation(rateLimitRef, rateLimitRequest.input);
    return verdict.ok ? undefined : createRateLimitedResponse(verdict.retryAfterMs);
  } catch (error) {
    logBetterAuthRateLimitError(error);
    return undefined;
  }
}

function logMissingBetterAuthRateLimit(request: Request): void {
  if (request.method !== "POST" || warnedMissingRateLimit) {
    return;
  }

  const pathname = new URL(request.url).pathname;
  if (!isRateLimitedAuthPath(pathname)) {
    return;
  }

  warnedMissingRateLimit = true;
  console.error(
    "[convex-auth] SECURITY: no rate limiter wired (config.refs.rateLimitAuthRequest is unset). " +
      "Sign-in/sign-up/2FA/password-reset are UNPROTECTED against brute-force and email bombing on Convex. " +
      "Wire a distributed limiter (@convex-dev/rate-limiter) for any production deployment.",
  );
}

function logBetterAuthRateLimitError(error: unknown): void {
  const errorKind = error instanceof Error ? error.name : typeof error;
  console.error(
    "[convex-auth] SECURITY: auth rate limiter errored; failing open for availability. Auth request allowed.",
    { errorKind },
  );
}

async function buildBetterAuthRateLimitRequest(
  request: Request,
  ipAddressHeaders: readonly string[],
): Promise<
  | {
      blocked: false;
      input: { ip: string; path: string; email?: string; subjectKey?: string };
    }
  | { blocked: true }
  | undefined
> {
  const pathname = new URL(request.url).pathname;
  const kind = classifyBetterAuthRateLimitPath(pathname);
  if (kind === "none") {
    return undefined;
  }

  if (kind === "twoFactorVerify") {
    const { subjectKey } = await resolveBetterAuthTwoFactorSubjectKey(request);
    if (subjectKey === undefined) {
      return { blocked: true };
    }

    return {
      blocked: false,
      input: {
        ip: readBetterAuthRequestIp(request, ipAddressHeaders),
        path: pathname,
        subjectKey,
      },
    };
  }

  return {
    blocked: false,
    input: {
      ip: readBetterAuthRequestIp(request, ipAddressHeaders),
      path: pathname,
      email: await readNormalizedBetterAuthEmail(request),
    },
  };
}

function classifyBetterAuthRateLimitPath(pathname: string) {
  if (/\/(sign-up|sign-in)\//.test(pathname)) {
    return "auth";
  }
  if (/\/(request-password-reset|forget-password|send-verification-email)/.test(pathname)) {
    return "emailTrigger";
  }
  if (/\/two-factor\/verify-/.test(pathname)) {
    return "twoFactorVerify";
  }

  return "none";
}

function isRateLimitedAuthPath(pathname: string): boolean {
  return classifyBetterAuthRateLimitPath(pathname) !== "none";
}

function readBetterAuthRequestIp(request: Request, ipAddressHeaders: readonly string[]): string {
  return (
    ipAddressHeaders
      .map((header) => request.headers.get(header))
      .find((value): value is string => typeof value === "string" && value.length > 0)
      ?.split(",")[0]
      ?.trim() ?? "unknown"
  );
}

async function readNormalizedBetterAuthEmail(request: Request): Promise<string | undefined> {
  try {
    const body: unknown = await request.clone().json();
    const email =
      typeof body === "object" && body !== null ? Reflect.get(body, "email") : undefined;
    return typeof email === "string" && email.length > 0
      ? email.normalize("NFC").trim().toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

async function resolveBetterAuthTwoFactorSubjectKey(
  request: Request,
): Promise<{ subjectKey: string | undefined }> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const pending =
    cookieHeader.match(/better-auth\.two_factor=([^;]+)/) ??
    cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  return {
    subjectKey: pending?.[1] ? await sha256Hex(decodeURIComponent(pending[1])) : undefined,
  };
}

function createRateLimitedResponse(retryAfterMs: number | undefined): Response {
  return new Response(JSON.stringify({ error: "rate_limited", code: "RATE_LIMITED" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(Math.ceil((retryAfterMs ?? 60_000) / 1000)),
    },
  });
}

async function normalizeBetterAuthHandlerResponse(
  auth: BuiltBetterAuthInstance,
  request: Request,
  verbose: boolean,
): Promise<Response> {
  try {
    const response = await auth.handler(request);
    if (response.status >= 500 && response.headers.get("content-type") === null) {
      logBareBetterAuthResponse(response, request, verbose);
      return createBetterAuthErrorResponse(500, "INTERNAL_ERROR", "internal_error");
    }
    return response;
  } catch (handlerError) {
    return normalizeBetterAuthHandlerError(handlerError, request, verbose);
  }
}

function logBareBetterAuthResponse(response: Response, request: Request, verbose: boolean): void {
  if (!verbose) {
    return;
  }

  console.error(
    `[convex-auth] normalizing bare ${response.status} on ${request.method} ${
      new URL(request.url).pathname
    }`,
  );
}

function normalizeBetterAuthHandlerError(
  handlerError: unknown,
  request: Request,
  verbose: boolean,
): Response {
  const message = handlerError instanceof Error ? handlerError.message : String(handlerError);
  const isBodyParse =
    handlerError instanceof SyntaxError ||
    /JSON|Unexpected (end of|token)|Unexpected end of input/i.test(message);
  if (verbose) {
    console.error(
      `[convex-auth] handler threw on ${request.method} ${new URL(request.url).pathname}: ${message}`,
    );
  }

  return createBetterAuthErrorResponse(
    isBodyParse ? 400 : 500,
    isBodyParse ? "BAD_REQUEST" : "INTERNAL_ERROR",
    isBodyParse ? "bad_request" : "internal_error",
  );
}

function createBetterAuthErrorResponse(status: number, code: string, error: string): Response {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type BetterAuthEmailCallbackArgs = {
  user: { id: string; email: string };
  url: string;
  token: string;
};

type BetterAuthEmailDeliveryConfig<Ctx> = {
  sendEmail?: (args: {
    ctx: Ctx;
    kind: "verify-email" | "reset-password";
    to: string;
    url: string;
    token: string;
    userId?: string;
  }) => Promise<void>;
  emailVerification?: {
    sendOnSignUp?: boolean;
    required?: boolean;
  };
};

/**
 * Pure assembler for Better Auth's email-delivery options from the
 * runtime config's `sendEmail` seam. Extracted (and exported) so the
 * wiring is unit-testable without booting the lazy Better Auth runtime.
 *
 * Returns `undefined` for each branch when `sendEmail` is absent, so the
 * caller spreads nothing and Better Auth keeps its default (no-send)
 * behavior — back-compatible.
 */
export function buildBetterAuthEmailDelivery<Ctx>(
  config: BetterAuthEmailDeliveryConfig<Ctx>,
  ctx: Ctx,
): {
  /** Merge into `emailAndPassword`: reset callback + requireEmailVerification. */
  emailAndPassword: {
    sendResetPassword?: (args: BetterAuthEmailCallbackArgs) => Promise<void>;
    requireEmailVerification?: boolean;
  };
  /** Spread as the top-level `emailVerification` BA option (or undefined). */
  emailVerification:
    | {
        sendOnSignUp: boolean;
        sendVerificationEmail: (args: BetterAuthEmailCallbackArgs) => Promise<void>;
      }
    | undefined;
} {
  const sendEmail = config.sendEmail;
  if (sendEmail === undefined) {
    // No transport wired — emit nothing. Back-compat.
    return { emailAndPassword: {}, emailVerification: undefined };
  }

  return {
    emailAndPassword: {
      sendResetPassword: async ({ user, url, token }) =>
        sendEmail({
          ctx,
          kind: "reset-password",
          to: user.email,
          url,
          token,
          userId: user.id,
        }),
      requireEmailVerification: config.emailVerification?.required ?? false,
    },
    emailVerification: {
      sendOnSignUp: config.emailVerification?.sendOnSignUp ?? false,
      sendVerificationEmail: async ({ user, url, token }) =>
        sendEmail({
          ctx,
          kind: "verify-email",
          to: user.email,
          url,
          token,
          userId: user.id,
        }),
    },
  };
}

export function resolveBetterAuthTrustedOrigins(args: {
  envName?: string;
  envValue?: string;
  origins?: readonly string[];
}): string[] {
  const envValue = args.envValue ?? process.env[args.envName ?? DEFAULT_TRUSTED_ORIGINS_ENV_NAME];

  return Array.from(new Set([...(args.origins ?? []), ...parseTrustedOrigins(envValue)])).filter(
    (origin) => origin.length > 0,
  );
}

async function runBestEffortUserSync(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.warn(
      `[convex-auth] user-sync trigger skipped (will self-heal on first authed request): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Builds the user-sync trigger callbacks. The consumer passes the
 * returned object into THEIR `createClient(component, { triggers })`.
 * Provisioning reads the authoritative trigger `doc` directly (NOT a
 * re-query — inside the create transaction an adapter.findOne for the
 * just-written user returns null and silently no-ops).
 */
export function createBetterAuthUserSyncTriggers<DataModel extends GenericDataModel>(opts: {
  betterAuthComponent: BetterAuthComponentApi<DataModel>;
  refs?: BetterAuthConvexRuntimeRefs;
  siteUrlEnvNames?: readonly string[];
  linkedAccountPageSize?: number;
}): BetterAuthUserSyncTriggers<DataModel> {
  const siteUrlEnvNames = opts.siteUrlEnvNames ?? DEFAULT_SITE_URL_ENV_NAMES;
  const linkedAccountPageSize = opts.linkedAccountPageSize ?? DEFAULT_LINKED_ACCOUNT_PAGE_SIZE;

  const syncFromDoc = async (
    ctx: GenericCtx<DataModel>,
    doc: BetterAuthUserSyncTriggerDoc,
  ): Promise<void> => {
    if (!hasQueryMutation(ctx)) {
      return;
    }
    const email = typeof doc.email === "string" ? doc.email : undefined;
    if (email === undefined) {
      return;
    }
    // Must match the issuer the RUNTIME uses to look the identity up
    // (JWT `iss`, a bare origin). A raw env read can yield the Better
    // Auth base URL with an `/api/auth` path, which keys the identity
    // row unreachably. resolveOptionalBetterAuthIdentityIssuer
    // canonicalizes to the origin exactly like the runtime fallback.
    const issuer = resolveOptionalBetterAuthIdentityIssuer() ?? readFirstEnv(siteUrlEnvNames) ?? "";
    const emailVerified = doc.emailVerified === true;
    const name = typeof doc.name === "string" ? doc.name : undefined;
    const image =
      typeof doc.image === "string"
        ? doc.image
        : typeof doc.imageUrl === "string"
          ? doc.imageUrl
          : undefined;
    const upsertRef = opts.refs?.upsertUserFromBetterAuth;
    if (upsertRef !== undefined) {
      await ctx.runMutation(upsertRef, {
        betterAuthUserId: doc._id,
        email,
        emailVerified,
        issuer,
        name,
        image,
        sessionId: undefined,
      });
    }
    await syncLinkedBetterAuthAccounts(ctx, {
      betterAuthComponent: opts.betterAuthComponent,
      betterAuthUserId: doc._id,
      email,
      emailVerified,
      issuer,
      linkedAccountPageSize,
      activeSessionId: undefined,
      refs: opts.refs,
    });
  };

  // A user-sync trigger is a side-effect: it must NEVER throw out of
  // the Better Auth user-create/update transaction, or it rolls the
  // whole signup back (FAILED_TO_CREATE_USER). When the issuer is
  // resolvable (explicit BETTER_AUTH_* env / split-host) provisioning
  // is transactional as before. When it is NOT (zero-env single-origin:
  // the trigger runs in a component mutation context with no deployment
  // URL env), this degrades to a no-op and the authenticated-context
  // self-heal provisions on the first request instead. Best-effort,
  // never fatal to auth.
  return {
    user: {
      onCreate: (ctx, doc) => runBestEffortUserSync(() => syncFromDoc(ctx, doc)),
      onUpdate: (ctx, newDoc) => runBestEffortUserSync(() => syncFromDoc(ctx, newDoc)),
      onDelete: async (ctx, doc) => {
        const deleteRef = opts.refs?.deleteUserFromBetterAuth;
        if (deleteRef !== undefined && hasQueryMutation(ctx)) {
          await ctx.runMutation(deleteRef, { betterAuthUserId: doc._id });
        }
      },
    },
  };
}

async function syncLinkedBetterAuthAccounts<DataModel extends GenericDataModel>(
  ctx: QueryMutationCtx<DataModel>,
  args: {
    betterAuthComponent: BetterAuthComponentApi<DataModel>;
    betterAuthUserId: string;
    email: string;
    emailVerified: boolean;
    issuer: string;
    linkedAccountPageSize: number;
    activeSessionId: string | undefined;
    refs: BetterAuthConvexRuntimeRefs | undefined;
  },
): Promise<void> {
  const provisionIdentityFromIdentity = args.refs?.provisionIdentityFromIdentity;
  if (provisionIdentityFromIdentity === undefined) {
    return;
  }

  const linkedAccountsResult = await ctx.runQuery(args.betterAuthComponent.adapter.findMany, {
    model: "account",
    paginationOpts: {
      cursor: null,
      numItems: args.linkedAccountPageSize,
    },
    where: [
      {
        field: "userId",
        value: args.betterAuthUserId,
      },
    ],
  });

  const linkedAccounts = readPageRecords(linkedAccountsResult);
  const identities = linkedAccounts.flatMap((account) => {
    const accountId = readOptionalString(account, "accountId");
    const providerId = readOptionalString(account, "providerId");
    return accountId === undefined || providerId === undefined ? [] : [{ accountId, providerId }];
  });
  await Promise.all(
    identities.map(({ accountId, providerId }) =>
      ctx.runMutation(provisionIdentityFromIdentity, {
        identity: {
          identityId: `${providerId}:${accountId}`,
          provider: providerId,
          issuer: args.issuer,
          subject: accountId,
          tokenIdentifier: `${args.issuer}|${providerId}|${accountId}`,
          email: args.email,
          emailVerified: args.emailVerified,
          sessionId: args.activeSessionId ?? null,
        },
        user: {
          email: args.email,
          emailVerified: args.emailVerified,
        },
      }),
    ),
  );
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasQueryMutation<DataModel extends GenericDataModel>(
  ctx: GenericCtx<DataModel>,
): ctx is QueryMutationCtx<DataModel> {
  return "runQuery" in ctx && "runMutation" in ctx;
}

function parseTrustedOrigins(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return (
    value
      .split(/\r?\n/)
      // Strip `#` comments: anything from a `#` to end-of-line is a comment, never
      // a trusted origin. Without this, `https://app # https://evil.com` would add
      // evil.com to the allow-list.
      .map((line) => line.split("#", 1)[0])
      .join(",")
      .split(/[\s,]+/)
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  );
}

function requireFirstEnv(names: readonly string[]): string {
  const value = readFirstEnv(names);
  if (value !== undefined) {
    return value;
  }

  throw new Error(`${names.join(" or ")} is required.`);
}

function readFirstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return trimTrailingSlash(value);
    }
  }

  return undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readPageRecords(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value) || !Array.isArray(value.page)) {
    return [];
  }

  return value.page.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
