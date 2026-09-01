import type { AuthProvider } from "convex/server";

export type ConvexAuthProvider = AuthProvider & {
  type: "customJwt";
  issuer: string;
  applicationID: string;
  algorithm: "RS256";
  jwks: string;
};

export function createConvexAuthProvider(args?: {
  issuer?: string;
  applicationID?: string;
  jwks?: string;
}): ConvexAuthProvider {
  const issuer = trimTrailingSlash(args?.issuer ?? resolveRequiredConvexSiteUrl());
  const applicationID = args?.applicationID ?? "convex";
  const jwks = args?.jwks ?? `${issuer}/.well-known/jwks.json`;

  return {
    type: "customJwt",
    issuer,
    applicationID,
    algorithm: "RS256",
    jwks,
  };
}

function resolveRequiredConvexSiteUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  if (url === undefined) {
    throw new Error(
      "createConvexAuthProvider requires an explicit issuer or the CONVEX_SITE_URL environment variable.",
    );
  }
  return url;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
