/**
 * Pure organization security policy enforcement (VOR-183).
 *
 * Storage lives in convex-auth organization `metadataJson.security`.
 * These helpers are the shared decision surface for glue, session lookup,
 * org switch, and consumer auth wrappers.
 */

export type OrganizationSecurityPolicy = {
  requireMfa: boolean;
  sessionTimeoutMinutes?: number;
};

export const ORGANIZATION_SESSION_TIMEOUT_MIN_MINUTES = 15;
export const ORGANIZATION_SESSION_TIMEOUT_MAX_MINUTES = 1440;

type MetadataRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MetadataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalTimeoutMinutes(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  if (
    rounded < ORGANIZATION_SESSION_TIMEOUT_MIN_MINUTES ||
    rounded > ORGANIZATION_SESSION_TIMEOUT_MAX_MINUTES
  ) {
    return undefined;
  }
  return rounded;
}

/**
 * Normalize org security from metadataJson (or a pre-parsed object).
 */
export function parseOrganizationSecurityPolicy(
  metadataJson: string | null | undefined
): OrganizationSecurityPolicy {
  const empty: OrganizationSecurityPolicy = { requireMfa: false };
  if (!metadataJson || metadataJson.trim() === "") {
    return empty;
  }
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!isRecord(parsed)) {
      return empty;
    }
    const security = parsed.security;
    if (!isRecord(security)) {
      return empty;
    }
    return {
      requireMfa: security.requireMfa === true,
      ...(optionalTimeoutMinutes(security.sessionTimeoutMinutes) !== undefined
        ? {
            sessionTimeoutMinutes: optionalTimeoutMinutes(
              security.sessionTimeoutMinutes
            ),
          }
        : {}),
    };
  } catch {
    return empty;
  }
}

export type OrganizationSecurityDenial = {
  code: "ORG_MFA_REQUIRED" | "ORG_SESSION_TIMEOUT";
  message: string;
};

/**
 * Account TOTP must be enabled when the org requires MFA.
 */
export function evaluateOrgMfaRequirement(args: {
  requireMfa: boolean;
  twoFactorEnabled: boolean;
}): OrganizationSecurityDenial | null {
  if (!args.requireMfa) {
    return null;
  }
  if (args.twoFactorEnabled) {
    return null;
  }
  return {
    code: "ORG_MFA_REQUIRED",
    message:
      "This organization requires two-factor authentication. Enable TOTP on your account, then try again.",
  };
}

/**
 * Reject sessions older than the org timeout (wall-clock from session create).
 */
export function evaluateOrgSessionTimeout(args: {
  sessionTimeoutMinutes?: number;
  sessionCreatedAt: number | null | undefined;
  now?: number;
}): OrganizationSecurityDenial | null {
  const minutes = args.sessionTimeoutMinutes;
  if (minutes === undefined) {
    return null;
  }
  if (
    typeof args.sessionCreatedAt !== "number" ||
    !Number.isFinite(args.sessionCreatedAt)
  ) {
    return {
      code: "ORG_SESSION_TIMEOUT",
      message: "Active session required",
    };
  }
  const now = args.now ?? Date.now();
  const maxAgeMs = minutes * 60_000;
  if (now - args.sessionCreatedAt > maxAgeMs) {
    return {
      code: "ORG_SESSION_TIMEOUT",
      message: `Organization session timeout exceeded (${minutes} minutes). Sign in again.`,
    };
  }
  return null;
}

export function evaluateOrganizationSecurityAccess(args: {
  policy: OrganizationSecurityPolicy;
  twoFactorEnabled: boolean;
  sessionCreatedAt?: number | null;
  now?: number;
}): OrganizationSecurityDenial | null {
  const mfaDenial = evaluateOrgMfaRequirement({
    requireMfa: args.policy.requireMfa,
    twoFactorEnabled: args.twoFactorEnabled,
  });
  if (mfaDenial !== null) {
    return mfaDenial;
  }
  return evaluateOrgSessionTimeout({
    sessionTimeoutMinutes: args.policy.sessionTimeoutMinutes,
    sessionCreatedAt: args.sessionCreatedAt,
    now: args.now,
  });
}
