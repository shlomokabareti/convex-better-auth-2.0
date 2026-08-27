import type { FunctionReference } from "convex/server";

export type NativeUserDoc = {
  _id: string;
  _creationTime: number;
  email?: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  emailTwoFactorStatus?: "disabled" | "enabled" | "reset_required";
  emailTwoFactorEmail?: string;
  emailTwoFactorEnabledAt?: number;
  emailTwoFactorDisabledAt?: number;
  emailTwoFactorLastVerifiedAt?: number;
  emailTwoFactorResetAt?: number;
  emailTwoFactorResetReason?: "missing_email" | "email_not_verified" | "email_changed";
  activeOrganizationId?: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  metadataJson?: string;
  createdAt: number;
  updatedAt: number;
};

export type NativeAccountDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  provider: string;
  issuer: string;
  subject: string;
  credentialHash: string;
  createdAt: number;
  updatedAt: number;
};

export type NativeSessionDoc = {
  _id: string;
  _creationTime: number;
  sessionId: string;
  userId: string;
  token: string;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
  revokedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type NativeIdentityDoc = {
  _id: string;
  _creationTime: number;
  identityId: string;
  userId: string;
  provider: string;
  issuer: string;
  subject: string;
  tokenIdentifier: string;
  email?: string;
  emailVerified: boolean;
  sessionId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type NativeEmailAndPasswordComponentHandle = {
  identity: {
    provisionFromIdentity: FunctionReference<
      "mutation",
      "public" | "internal",
      {
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
          name?: string;
          image?: string;
          emailVerified: boolean;
        };
      },
      {
        createdUser: boolean;
        identityId: string;
        linkedExistingIdentity: boolean;
        userId: string;
      },
      string
    >;
  };
  native: {
    accounts: {
      createAccount: FunctionReference<
        "mutation",
        "public" | "internal",
        {
          userId: string;
          provider: string;
          issuer: string;
          subject: string;
          credentialHash: string;
        },
        string,
        string
      >;
      getAccountBySubject: FunctionReference<
        "query",
        "public" | "internal",
        { provider: string; issuer: string; subject: string },
        NativeAccountDoc | null,
        string
      >;
    };
    sessions: {
      createSession: FunctionReference<
        "mutation",
        "public" | "internal",
        {
          sessionId: string;
          userId: string;
          token: string;
          expiresAt: number;
        },
        string,
        string
      >;
      revokeSession: FunctionReference<
        "mutation",
        "public" | "internal",
        { sessionId: string },
        string | null,
        string
      >;
    };
    identities: {
      getNativeIdentityByUser: FunctionReference<
        "query",
        "public" | "internal",
        { userId: string; provider: string; issuer: string },
        NativeIdentityDoc | null,
        string
      >;
    };
    users: {
      getUserByEmail: FunctionReference<
        "query",
        "public" | "internal",
        { email: string },
        NativeUserDoc | null,
        string
      >;
    };
  };
};
