import { v } from "convex/values";
import type { FunctionReference } from "convex/server";

export type VerificationCodeType = "email_verification" | "password_reset";

export type NativeAuthUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
};

export function toNativeAuthUser(user: {
  _id: string;
  email?: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}): NativeAuthUser {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const nativeAuthUserValidator = v.object({
  id: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  emailVerified: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export type NativeAuthSession = {
  token: string | null;
  refreshToken?: string;
  user: NativeAuthUser;
  userId?: string;
  identityId?: string;
  sessionId?: string;
  redirect?: boolean;
  url?: string;
};

export type NativeVerificationCodeDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  type: VerificationCodeType;
  tokenHash: string;
  expiresAt: number;
  consumedAt?: number;
  createdAt: number;
  updatedAt: number;
};

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

export type NativeRefreshTokenDoc = {
  _id: string;
  _creationTime: number;
  tokenHash: string;
  sessionId: string;
  userId: string;
  expiresAt: number;
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
        account?: { credentialHash: string };
        verificationCode?: { tokenHash: string; expiresAt: number };
        allowLink?: boolean;
      },
      {
        createdUser: boolean;
        identityId?: string;
        linkedExistingIdentity: boolean;
        userId: string;
        duplicate?: boolean;
        user?: NativeUserDoc;
      },
      string
    >;
    getUserAndAccount: FunctionReference<
      "query",
      "public" | "internal",
      { email: string },
      { user: NativeUserDoc; identity: NativeIdentityDoc; account: NativeAccountDoc } | null,
      string
    >;
    verifyEmail: FunctionReference<
      "mutation",
      "public" | "internal",
      { tokenHash: string; provider: string; issuer: string },
      { success: boolean; user?: NativeUserDoc; reason?: string },
      string
    >;
    resetPassword: FunctionReference<
      "mutation",
      "public" | "internal",
      {
        tokenHash: string;
        credentialHash: string;
        provider: string;
        issuer: string;
        revokeSessions?: boolean;
      },
      { status: boolean; user?: NativeUserDoc; reason?: string },
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
      updateCredentialHash: FunctionReference<
        "mutation",
        "public" | "internal",
        { accountId: string; credentialHash: string },
        void,
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
      listSessionsByUser: FunctionReference<
        "query",
        "public" | "internal",
        { userId: string },
        NativeSessionDoc[],
        string
      >;
      getSessionByToken: FunctionReference<
        "query",
        "public" | "internal",
        { token: string },
        NativeSessionDoc | null,
        string
      >;
      getSessionBySessionId: FunctionReference<
        "query",
        "public" | "internal",
        { sessionId: string },
        NativeSessionDoc | null,
        string
      >;
      revokeSessionsForUser: FunctionReference<
        "mutation",
        "public" | "internal",
        { userId: string; excludeSessionId?: string },
        number,
        string
      >;
      rotateSession: FunctionReference<
        "mutation",
        "public" | "internal",
        {
          oldRefreshTokenHash: string;
          newSessionId: string;
          newSessionToken: string;
          newSessionExpiresAt: number;
          newSessionIpAddress?: string;
          newSessionUserAgent?: string;
          newRefreshTokenHash: string;
          newRefreshTokenExpiresAt: number;
          provider: string;
          issuer: string;
        },
        { user: NativeUserDoc; identityId: string } | null,
        string
      >;
    };
    refreshTokens: {
      createRefreshToken: FunctionReference<
        "mutation",
        "public" | "internal",
        { tokenHash: string; sessionId: string; userId: string; expiresAt: number },
        string,
        string
      >;
      getRefreshTokenByTokenHash: FunctionReference<
        "query",
        "public" | "internal",
        { tokenHash: string },
        NativeRefreshTokenDoc | null,
        string
      >;
      consumeRefreshToken: FunctionReference<
        "mutation",
        "public" | "internal",
        { tokenHash: string },
        NativeRefreshTokenDoc | null,
        string
      >;
      revokeRefreshTokensForSession: FunctionReference<
        "mutation",
        "public" | "internal",
        { sessionId: string },
        number,
        string
      >;
      revokeRefreshTokensForUser: FunctionReference<
        "mutation",
        "public" | "internal",
        { userId: string },
        number,
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
      markEmailVerified: FunctionReference<
        "mutation",
        "public" | "internal",
        { identityId: string; emailVerified: boolean },
        void,
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
      getUserById: FunctionReference<
        "query",
        "public" | "internal",
        { userId: string },
        NativeUserDoc | null,
        string
      >;
      markEmailVerified: FunctionReference<
        "mutation",
        "public" | "internal",
        { userId: string; emailVerified: boolean },
        void,
        string
      >;
    };
    codes: {
      createVerificationCode: FunctionReference<
        "mutation",
        "public" | "internal",
        {
          userId: string;
          type: VerificationCodeType;
          tokenHash: string;
          expiresAt: number;
        },
        string,
        string
      >;
      getVerificationCodeByTokenHash: FunctionReference<
        "query",
        "public" | "internal",
        { tokenHash: string; type: VerificationCodeType },
        NativeVerificationCodeDoc | null,
        string
      >;
      consumeVerificationCode: FunctionReference<
        "mutation",
        "public" | "internal",
        { tokenHash: string; type: VerificationCodeType },
        NativeVerificationCodeDoc | null,
        string
      >;
      revokeVerificationCodesForUser: FunctionReference<
        "mutation",
        "public" | "internal",
        { userId: string; type: VerificationCodeType },
        number,
        string
      >;
    };
  };
};

/**
 * OAuth reuses the same component functions as native email/password.
 */
export type NativeOAuthComponentHandle = NativeEmailAndPasswordComponentHandle;
