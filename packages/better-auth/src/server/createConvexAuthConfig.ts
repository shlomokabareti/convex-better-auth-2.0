import type { AuthProvider } from "convex/server";

type BetterAuthJwksDocument = {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  expiresAt?: number;
  alg?: string;
  crv?: string;
};

type JsonWebKey = Record<string, unknown> & {
  alg?: string;
  crv?: string;
  kid?: string;
};

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

function parseJsonObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a JSON object");
  }
  return Object.fromEntries(Object.entries(value));
}

function parseBetterAuthJwks(text: string): BetterAuthJwksDocument[] {
  const value: unknown = JSON.parse(text);
  if (!Array.isArray(value)) throw new TypeError("Expected a JWKS document array");
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError("Invalid JWKS document");
    }
    const id = Reflect.get(entry, "id");
    const publicKey = Reflect.get(entry, "publicKey");
    const privateKey = Reflect.get(entry, "privateKey");
    const createdAt = Reflect.get(entry, "createdAt");
    if (
      typeof id !== "string" ||
      typeof publicKey !== "string" ||
      typeof privateKey !== "string" ||
      typeof createdAt !== "number"
    ) {
      throw new TypeError("Invalid JWKS document");
    }
    const expiresAt = Reflect.get(entry, "expiresAt");
    const alg = Reflect.get(entry, "alg");
    const crv = Reflect.get(entry, "crv");
    return {
      id,
      publicKey,
      privateKey,
      createdAt,
      expiresAt: typeof expiresAt === "number" ? expiresAt : undefined,
      alg: typeof alg === "string" ? alg : undefined,
      crv: typeof crv === "string" ? crv : undefined,
    };
  });
}

export type BetterAuthConvexAuthProvider = AuthProvider & {
  type: "customJwt";
  issuer: string;
  applicationID: string;
  algorithm: "RS256";
  jwks: string;
};

export function createConvexAuthConfig(args?: {
  basePath?: string;
  baseURL?: string;
  issuer?: string;
  jwks?: string;
  jwksUrl?: string;
  applicationID?: string;
}): BetterAuthConvexAuthProvider {
  if (
    args?.baseURL === undefined &&
    args?.issuer === undefined &&
    args?.jwksUrl === undefined &&
    args?.applicationID === undefined
  ) {
    return createDefaultConvexAuthProvider({
      basePath: args?.basePath,
      jwks: args?.jwks,
    });
  }

  const applicationID = args?.applicationID ?? "convex";
  const issuer = resolveIssuer(args);
  const jwks = resolveJwks(args, issuer);

  return {
    type: "customJwt" as const,
    issuer,
    applicationID,
    algorithm: "RS256" as const,
    jwks,
  };
}

// Single-origin is the product default: a consumer's auth.config.ts
// MUST call createConvexAuthConfig() with no args, so the file contains
// zero process.env references. Convex's deploy-time auth-config
// analyzer recurses the import graph and treats ANY reachable
// process.env.X as a hard requirement — if unset on the target
// deployment the deploy does not enable HTTP actions and every route
// 404s. An env-reading helper here is a footgun (it re-poisons every
// fresh deployment), so it is intentionally NOT provided. The no-arg
// path self-configures the issuer from CONVEX_SITE_URL, which Convex
// sets on every deployment — making convex-auth portable to any fresh
// Convex deployment with zero env.

function createDefaultConvexAuthProvider(args?: {
  basePath?: string;
  jwks?: string;
}): BetterAuthConvexAuthProvider {
  const issuer = resolveRequiredConvexSiteUrl();

  return {
    type: "customJwt",
    issuer,
    applicationID: "convex",
    algorithm: "RS256",
    jwks:
      args?.jwks !== undefined
        ? serializePublicJwks(parseBetterAuthJwks(args.jwks))
        : `${issuer}${args?.basePath ?? "/api/auth"}/convex/jwks`,
  };
}

function resolveIssuer(args: {
  basePath?: string;
  baseURL?: string;
  issuer?: string;
  jwks?: string;
  jwksUrl?: string;
  applicationID?: string;
}): string {
  if (args.issuer !== undefined) {
    return trimTrailingSlash(args.issuer);
  }

  if (args.baseURL !== undefined) {
    return new URL(args.baseURL).origin;
  }

  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  if (convexSiteUrl === undefined) {
    throw new Error(
      "createConvexAuthConfig requires issuer, baseURL, or CONVEX_SITE_URL to be set.",
    );
  }

  return trimTrailingSlash(convexSiteUrl);
}

function resolveJwks(
  args: {
    basePath?: string;
    baseURL?: string;
    issuer?: string;
    jwks?: string;
    jwksUrl?: string;
    applicationID?: string;
  },
  issuer: string,
): string {
  if (args.jwks !== undefined) {
    return serializePublicJwks(parseBetterAuthJwks(args.jwks));
  }

  if (args.jwksUrl !== undefined) {
    return args.jwksUrl;
  }

  if (args.baseURL !== undefined) {
    return `${trimTrailingSlash(args.baseURL)}/convex/jwks`;
  }

  return `${issuer}${args.basePath ?? "/api/auth"}/convex/jwks`;
}

export function createPublicBetterAuthJwks(jwks: BetterAuthJwksDocument[]): JsonWebKeySet {
  return {
    keys: jwks.map((keySet) => ({
      alg: keySet.alg ?? "EdDSA",
      crv: keySet.crv,
      ...parseJsonObject(keySet.publicKey),
      kid: keySet.id,
    })),
  };
}

function serializePublicJwks(jwks: BetterAuthJwksDocument[]): string {
  return `data:text/plain;charset=utf-8;base64,${btoa(
    JSON.stringify(createPublicBetterAuthJwks(jwks)),
  )}`;
}

function resolveRequiredConvexSiteUrl(): string {
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  if (convexSiteUrl !== undefined) {
    return trimTrailingSlash(convexSiteUrl);
  }

  // CONVEX_SITE_URL is HTTP-context-only; CONVEX_CLOUD_URL is injected
  // into every Convex execution context. Derive the .site origin so
  // single-origin works with zero env regardless of context.
  const convexCloudUrl = process.env.CONVEX_CLOUD_URL;
  if (convexCloudUrl !== undefined) {
    return trimTrailingSlash(convexCloudUrl).replace(".convex.cloud", ".convex.site");
  }

  throw new Error(
    "createConvexAuthConfig requires issuer, baseURL, CONVEX_SITE_URL, or CONVEX_CLOUD_URL to be set.",
  );
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
