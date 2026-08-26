/**
 * Generic identity shape used by the public convex-better-auth runtime.
 * Mirrors the fields convex-auth normalizes to, but does not depend on
 * any private packages.
 */
export type NormalizedAuthIdentity = {
  provider: string;
  subject: string;
  issuer: string;
  tokenIdentifier: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  imageUrl: string | null;
  sessionId: string | null;
  rawClaims: Record<string, unknown>;
};

export type AuthReadinessState =
  | "signedOut"
  | "providerLoading"
  | "providerReady"
  | "tokenReady"
  | "tokenRefreshing"
  | "convexConnecting"
  | "convexReady"
  | "degraded"
  | "reauthRequired";

export type AuthRuntimeStatus = {
  state: AuthReadinessState;
  providerAuthenticated: boolean;
  tokenAvailable: boolean;
  convexAuthenticated: boolean;
  isRecovering: boolean;
  reauthRequired: boolean;
};
