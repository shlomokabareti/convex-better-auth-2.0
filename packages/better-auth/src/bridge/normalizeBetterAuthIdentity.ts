import type { NormalizedAuthIdentity } from "../types";

import { BETTER_AUTH_IDENTITY_PROVIDER, buildBetterAuthTokenIdentifier } from "./identityKeys";
import type { BetterAuthIdentityMapper } from "./types";

export const normalizeBetterAuthIdentity: BetterAuthIdentityMapper = (identity) => {
  return {
    provider: BETTER_AUTH_IDENTITY_PROVIDER,
    subject: identity.subject,
    issuer: identity.issuer,
    tokenIdentifier: buildBetterAuthTokenIdentifier(identity.subject, identity.issuer),
    email: identity.email ?? null,
    emailVerified: identity.emailVerified ?? false,
    name: identity.name ?? null,
    imageUrl: identity.imageUrl ?? null,
    sessionId: identity.sessionId ?? null,
    rawClaims: identity.rawClaims ?? {},
  } satisfies NormalizedAuthIdentity;
};
