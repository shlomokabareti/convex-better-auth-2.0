import type { NormalizedAuthIdentity } from "../coreTypes";

export type AuthIdentityRecord = {
  identityId: string;
  userId: string;
  provider: NormalizedAuthIdentity["provider"];
  subject: string;
  issuer: string;
  tokenIdentifier: string;
  email: string | null;
  emailVerified: boolean;
  sessionId: string | null;
};

export type IdentityProvisionResult = {
  userId: string;
  identityId: string;
  createdUser: boolean;
  linkedExistingIdentity: boolean;
};
