import type { NormalizedAuthIdentity } from "../types";

export type BetterAuthServerConfig = {
  baseURL?: string;
  issuer?: string;
  jwksURL?: string;
  enableJwt?: boolean;
  convexApplicationID?: string;
};

export type BetterAuthServerIdentity = {
  subject: string;
  issuer: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  imageUrl?: string | null;
  sessionId?: string | null;
  rawClaims?: Record<string, unknown>;
};

export type BetterAuthIdentityNormalizer = (
  identity: BetterAuthServerIdentity
) => NormalizedAuthIdentity;
