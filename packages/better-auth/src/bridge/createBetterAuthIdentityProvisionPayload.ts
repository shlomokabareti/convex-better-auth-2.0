import {
  buildBetterAuthIdentityId,
  buildBetterAuthTokenIdentifier,
  getBetterAuthIdentityProvider,
  readIdentityEmailVerified,
  readIdentitySessionId,
  readOptionalIdentityString,
  readRequiredIdentityEmail,
  resolveBetterAuthIdentityIssuer,
  type BetterAuthIdentityClaims,
  type ResolveBetterAuthIdentityIssuerArgs,
} from "./identityKeys";

export type BetterAuthIdentityProvisionPayload = {
  identity: {
    identityId: string;
    provider: string;
    issuer: string;
    subject: string;
    tokenIdentifier: string;
    email?: string;
    emailVerified: boolean;
    sessionId?: string | null;
  };
  user: {
    email?: string;
    emailVerified: boolean;
    name?: string;
    image?: string;
  };
};

export type CreateBetterAuthIdentityProvisionPayloadArgs =
  ResolveBetterAuthIdentityIssuerArgs & {
    betterAuthUserId: string;
    email: string;
    emailVerified: boolean;
    name?: string | null;
    image?: string | null;
    sessionId?: string | null;
  };

// Auth-method-agnostic: identity is keyed off `betterAuthUserId` (the Better
// Auth user id / subject) + issuer, so a Google-created user provisions the
// same `auth_identities` row as an email/password user. Better Auth is always
// the issuer; only `email`/`name`/`image` claims are consumed, all of which
// social providers populate identically.
export function createBetterAuthIdentityProvisionPayload(
  args: CreateBetterAuthIdentityProvisionPayloadArgs
): BetterAuthIdentityProvisionPayload {
  const issuer = resolveBetterAuthIdentityIssuer(args);
  const email = normalizeRequiredEmail(args.email);
  const name = normalizeOptionalString(args.name);
  const image = normalizeOptionalString(args.image);

  return {
    identity: {
      identityId: buildBetterAuthIdentityId(args.betterAuthUserId, issuer),
      provider: getBetterAuthIdentityProvider(),
      issuer,
      subject: args.betterAuthUserId,
      tokenIdentifier: buildBetterAuthTokenIdentifier(
        args.betterAuthUserId,
        issuer
      ),
      email,
      emailVerified: args.emailVerified,
      sessionId: normalizeOptionalString(args.sessionId) ?? null,
    },
    user: {
      email,
      emailVerified: args.emailVerified,
      ...(name === undefined ? {} : { name }),
      ...(image === undefined ? {} : { image }),
    },
  };
}

export function createBetterAuthIdentityProvisionPayloadFromClaims(
  identity: BetterAuthIdentityClaims,
  args: ResolveBetterAuthIdentityIssuerArgs = {}
): BetterAuthIdentityProvisionPayload {
  return createBetterAuthIdentityProvisionPayload({
    ...args,
    issuer: args.issuer ?? identity.issuer,
    betterAuthUserId: identity.subject,
    email: readRequiredIdentityEmail(identity),
    emailVerified: readIdentityEmailVerified(identity),
    name: readOptionalIdentityString(identity, "name"),
    image:
      readOptionalIdentityString(identity, "image") ??
      readOptionalIdentityString(identity, "imageUrl"),
    sessionId: readIdentitySessionId(identity),
  });
}

function normalizeRequiredEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("Better Auth identity email is required.");
  }
  return normalized;
}

function normalizeOptionalString(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? undefined
    : normalized;
}
