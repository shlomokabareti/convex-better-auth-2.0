import type { NormalizedAuthIdentity } from "../coreTypes";
import type { AuthIdentityRecord } from "./types";

export function identityRecordToNormalizedIdentity(
  record: AuthIdentityRecord,
): NormalizedAuthIdentity {
  return {
    provider: record.provider,
    subject: record.subject,
    issuer: record.issuer,
    tokenIdentifier: record.tokenIdentifier,
    email: record.email,
    emailVerified: record.emailVerified,
    name: null,
    imageUrl: null,
    sessionId: record.sessionId,
    rawClaims: {},
  };
}
