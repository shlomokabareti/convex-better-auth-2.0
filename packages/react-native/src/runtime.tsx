import { useCallback, useEffect, useState } from "react";

import {
  createExpoBetterAuthClient,
  type ExpoBetterAuthClient,
  type ExpoBetterAuthClientOptions,
} from "./client";
import {
  normalizeExpoTrustedOrigin,
  resolveExpoAuthConfig,
  type ExpoPlatformOS,
  type ExpoResolvedAuthConfig,
} from "./config";

export type ExpoAuthUser = {
  email?: string | null;
  id: string;
  image?: string | null;
  name?: string | null;
};

export type ExpoAuthSession = {
  user?: ExpoAuthUser | null;
};

export type ExpoAuthSessionState = {
  data?: ExpoAuthSession | null;
  error?: unknown;
  isPending: boolean;
};

export type ExpoAuthActionResult<Data = unknown> = {
  data?: Data | null;
  error?: {
    code?: string;
    message?: string;
    status?: number;
    statusText?: string;
  } | null;
};

export type ExpoAuthRuntimeOptions = Omit<
  ExpoBetterAuthClientOptions,
  "baseURL" | "platformOS" | "scheme"
> & {
  convexSiteUrl?: string | null;
  convexUrl?: string | null;
  platformOS: ExpoPlatformOS;
  scheme?: string | readonly string[] | null;
};

export type ExpoAuthRuntime = {
  authClient: ExpoBetterAuthClient;
  config: ExpoResolvedAuthConfig;
  useAppAuth: () => {
    isLoaded: boolean;
    isSignedIn: boolean;
    session: ExpoAuthSession | null;
    userId: string | null;
  };
  useAppAuthActions: () => {
    signInEmail: (args: { email: string; password: string }) => Promise<ExpoAuthActionResult>;
    signInSocial: (args: { provider: string }) => Promise<ExpoAuthActionResult>;
    signOut: () => Promise<ExpoAuthActionResult>;
    signUpEmail: (args: {
      email: string;
      name: string;
      password: string;
    }) => Promise<ExpoAuthActionResult>;
  };
  useAppUser: () => {
    isLoaded: boolean;
    isSignedIn: boolean;
    user: ExpoAuthUser | null;
  };
};

export function createExpoAuthRuntime(options: ExpoAuthRuntimeOptions): ExpoAuthRuntime {
  const config = resolveExpoAuthConfig(options);
  const authClient = createExpoBetterAuthClient({
    ...options,
    baseURL: config.convexSiteUrl,
    platformOS: config.platformOS,
    scheme: config.scheme,
  });
  const sessionClient = authClient;
  const actionClient = authClient;
  // The expoClient plugin opens the system browser for the OAuth round trip
  // and listens for the deep link back into the app. Better Auth needs the
  // app's scheme-based callback URL (e.g. `plasma://`) so the provider
  // redirect lands back inside the app rather than on the web origin.
  const socialCallbackURL = normalizeExpoTrustedOrigin(config.scheme);

  function useAppAuth() {
    const session = sessionClient.useSession();
    const authSession = session.data ?? null;
    const user = authSession?.user ?? null;

    return {
      isLoaded: !session.isPending,
      isSignedIn: user !== null,
      session: authSession,
      userId: user?.id ?? null,
    };
  }

  function useAppUser() {
    const auth = useAppAuth();
    const user = auth.session?.user ?? null;

    return {
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      user,
    };
  }

  function useAppAuthActions() {
    return {
      signInEmail: (args: { email: string; password: string }) => actionClient.signIn.email(args),
      signInSocial: (args: { provider: string }) =>
        actionClient.signIn.social({
          provider: args.provider,
          callbackURL: socialCallbackURL,
        }),
      signOut: () => actionClient.signOut(),
      signUpEmail: (args: { email: string; name: string; password: string }) =>
        actionClient.signUp.email(args),
    };
  }

  return {
    authClient,
    config,
    useAppAuth,
    useAppAuthActions,
    useAppUser,
  };
}

// ── Session management hooks (PR A of #3) ─────────────────────────────
// RN mirrors web's surface. Same hook signatures + return shapes — see
// packages/react/src/better-auth-runtime.tsx for the source of truth.
// Consumer code should be identical on both platforms.

export type ExpoAuthSessionListItem = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type SessionManagementClient = {
  listSessions?: () => Promise<{
    data?: ExpoAuthSessionListItem[] | null;
    error?: unknown;
  }>;
  revokeSession?: (args: { token: string }) => Promise<{
    data?: { status?: boolean } | null;
    error?: unknown;
  }>;
  revokeOtherSessions?: () => Promise<{
    data?: { status?: boolean } | null;
    error?: unknown;
  }>;
  updateUser?: (args: { name?: string; image?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  forgetPassword?: (args: { email: string; redirectTo?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  resetPassword?: (args: { newPassword: string; token: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  sendVerificationEmail?: (args: { email: string; callbackURL?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  verifyEmail?: (args: { query: { token: string } }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  changeEmail?: (args: { newEmail: string; callbackURL?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
};

export type ExpoAuthSessionListState = {
  sessions: ExpoAuthSessionListItem[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useExpoAuthSessionList(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthSessionListState {
  const [sessions, setSessions] = useState<ExpoAuthSessionListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (authClient?.listSessions === undefined) {
      setSessions(null);
      setIsLoading(false);
      setError("Session listing is not available on this auth client");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.listSessions();
      if (result.error) {
        setError(result.error instanceof Error ? result.error.message : "Could not load sessions");
        setSessions(null);
        return;
      }
      setSessions(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions");
      setSessions(null);
    } finally {
      setIsLoading(false);
    }
  }, [authClient]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { sessions, isLoading, error, refetch };
}

export type ExpoAuthRevokeSessionState = {
  revokeSession: (args: { token: string }) => Promise<{ ok: boolean; error: string | null }>;
  revokeOtherSessions: () => Promise<{ ok: boolean; error: string | null }>;
  isRevoking: boolean;
};

export function useExpoAuthRevokeSession(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthRevokeSessionState {
  const [isRevoking, setIsRevoking] = useState(false);

  const revokeSession = useCallback(
    async (args: { token: string }) => {
      if (authClient?.revokeSession === undefined) {
        return {
          ok: false,
          error: "Revoke is not available on this auth client",
        };
      }
      setIsRevoking(true);
      try {
        const result = await authClient.revokeSession(args);
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Revoke failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Revoke failed",
        };
      } finally {
        setIsRevoking(false);
      }
    },
    [authClient],
  );

  const revokeOtherSessions = useCallback(async () => {
    if (authClient?.revokeOtherSessions === undefined) {
      return {
        ok: false,
        error: "Revoke is not available on this auth client",
      };
    }
    setIsRevoking(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : "Revoke failed";
        return { ok: false, error: msg };
      }
      return { ok: true, error: null };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Revoke failed",
      };
    } finally {
      setIsRevoking(false);
    }
  }, [authClient]);

  return { revokeSession, revokeOtherSessions, isRevoking };
}

export type ExpoAuthUpdateProfileState = {
  updateProfile: (args: {
    name?: string;
    image?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isUpdating: boolean;
};

export function useExpoAuthUpdateProfile(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthUpdateProfileState {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateProfile = useCallback(
    async (args: { name?: string; image?: string }) => {
      if (authClient?.updateUser === undefined) {
        return {
          ok: false,
          error: "Profile update is not available on this auth client",
        };
      }
      setIsUpdating(true);
      try {
        const result = await authClient.updateUser(args);
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Update failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Update failed",
        };
      } finally {
        setIsUpdating(false);
      }
    },
    [authClient],
  );

  return { updateProfile, isUpdating };
}

// ---- Password-recovery hooks (RN mirror of web) ----

export type ExpoAuthForgotPasswordState = {
  requestReset: (args: {
    email: string;
    redirectTo?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isRequesting: boolean;
};

export function useExpoAuthForgotPassword(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthForgotPasswordState {
  const [isRequesting, setIsRequesting] = useState(false);

  const requestReset = useCallback(
    async (args: { email: string; redirectTo?: string }) => {
      if (authClient?.forgetPassword === undefined) {
        return {
          ok: false,
          error: "Password recovery is not available on this auth client",
        };
      }
      setIsRequesting(true);
      try {
        const result = await authClient.forgetPassword(args);
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Reset request failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Reset request failed",
        };
      } finally {
        setIsRequesting(false);
      }
    },
    [authClient],
  );

  return { requestReset, isRequesting };
}

export type ExpoAuthResetPasswordState = {
  resetPassword: (args: {
    newPassword: string;
    token: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isResetting: boolean;
};

export function useExpoAuthResetPassword(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthResetPasswordState {
  const [isResetting, setIsResetting] = useState(false);

  const resetPassword = useCallback(
    async (args: { newPassword: string; token: string }) => {
      if (authClient?.resetPassword === undefined) {
        return {
          ok: false,
          error: "Password reset is not available on this auth client",
        };
      }
      setIsResetting(true);
      try {
        const result = await authClient.resetPassword(args);
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Reset failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Reset failed",
        };
      } finally {
        setIsResetting(false);
      }
    },
    [authClient],
  );

  return { resetPassword, isResetting };
}

// ---- Email-verification hooks (RN mirror of web) ----

export type ExpoAuthVerifyEmailStatus = "idle" | "verifying" | "verified" | "error";

export type ExpoAuthVerifyEmailState = {
  status: ExpoAuthVerifyEmailStatus;
  error: string | null;
  verifyEmail: (args: { token: string }) => Promise<{ ok: boolean; error: string | null }>;
};

export function useExpoAuthVerifyEmail(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthVerifyEmailState {
  const [status, setStatus] = useState<ExpoAuthVerifyEmailStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const verifyEmail = useCallback(
    async (args: { token: string }) => {
      if (authClient?.verifyEmail === undefined) {
        const msg = "Email verification is not available on this auth client";
        setStatus("error");
        setError(msg);
        return { ok: false, error: msg };
      }
      setStatus("verifying");
      setError(null);
      try {
        const result = await authClient.verifyEmail({
          query: { token: args.token },
        });
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Verification failed";
          setStatus("error");
          setError(msg);
          return { ok: false, error: msg };
        }
        setStatus("verified");
        return { ok: true, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Verification failed";
        setStatus("error");
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [authClient],
  );

  return { status, error, verifyEmail };
}

export type ExpoAuthResendVerificationState = {
  resend: (args: {
    email: string;
    callbackURL?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isResending: boolean;
};

export function useExpoAuthResendVerification(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthResendVerificationState {
  const [isResending, setIsResending] = useState(false);

  const resend = useCallback(
    async (args: { email: string; callbackURL?: string }) => {
      if (authClient?.sendVerificationEmail === undefined) {
        return {
          ok: false,
          error: "Resend is not available on this auth client",
        };
      }
      setIsResending(true);
      try {
        const result = await authClient.sendVerificationEmail(args);
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Resend failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Resend failed",
        };
      } finally {
        setIsResending(false);
      }
    },
    [authClient],
  );

  return { resend, isResending };
}

// ---- Email-change hooks (RN mirror) ----

export type ExpoAuthChangeEmailState = {
  requestChange: (args: {
    newEmail: string;
    callbackURL?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isRequesting: boolean;
};

export function useExpoAuthChangeEmail(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
): ExpoAuthChangeEmailState {
  const [isRequesting, setIsRequesting] = useState(false);

  const requestChange = useCallback(
    async (args: { newEmail: string; callbackURL?: string }) => {
      if (authClient?.changeEmail === undefined) {
        return {
          ok: false,
          error: "Email change is not available on this auth client",
        };
      }
      setIsRequesting(true);
      try {
        const result = await authClient.changeEmail(args);
        if (result.error) {
          const msg =
            result.error instanceof Error ? result.error.message : "Email change request failed";
          return { ok: false, error: msg };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Email change request failed",
        };
      } finally {
        setIsRequesting(false);
      }
    },
    [authClient],
  );

  return { requestChange, isRequesting };
}

// ---- Profile image upload hook (RN) ----
//
// Same shape as web. The RN flavor takes a Blob | string URI because
// expo-image-picker / react-native-image-picker yield a local file
// URI, not a File. Consumer's `uploadFile` converts it to a public URL.

export type ExpoAuthUploadProfileImageState = {
  uploadAndSave: (
    file: Blob | string,
  ) => Promise<{ ok: boolean; url: string | null; error: string | null }>;
  isUploading: boolean;
};

export function useExpoAuthUploadProfileImage(
  authClient: (ExpoBetterAuthClient & SessionManagementClient) | null,
  options: { uploadFile: (file: Blob | string) => Promise<string> },
): ExpoAuthUploadProfileImageState {
  const [isUploading, setIsUploading] = useState(false);
  const { uploadFile } = options;

  const uploadAndSave = useCallback(
    async (file: Blob | string) => {
      if (authClient?.updateUser === undefined) {
        return {
          ok: false,
          url: null,
          error: "Profile update is not available on this auth client",
        };
      }
      setIsUploading(true);
      try {
        const url = await uploadFile(file);
        const result = await authClient.updateUser({ image: url });
        if (result.error) {
          const msg = result.error instanceof Error ? result.error.message : "Image save failed";
          return { ok: false, url: null, error: msg };
        }
        return { ok: true, url, error: null };
      } catch (err) {
        return {
          ok: false,
          url: null,
          error: err instanceof Error ? err.message : "Image upload failed",
        };
      } finally {
        setIsUploading(false);
      }
    },
    [authClient, uploadFile],
  );

  return { uploadAndSave, isUploading };
}

// ---- Two-factor (TOTP + backup codes) hooks (RN mirror of web) ----
//
// The package's Expo client factory wires Better Auth's twoFactorClient
// plugin automatically, so the real client carries `twoFactor.*`. We
// guard on it anyway (same optional-augment pattern as session/email
// methods) so a hand-built client without the plugin degrades to a
// clear "not available" error rather than throwing.

const TWO_FACTOR_UNAVAILABLE_RN = "Two-factor authentication is not available on this auth client";

type TwoFactorClient = {
  twoFactor?: {
    enable: (args: { password: string; issuer?: string }) => Promise<{
      data?: { totpURI: string; backupCodes: string[] } | null;
      error?: { message?: string | null } | null;
    }>;
    verifyTotp: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: { token?: string | null } | null;
      error?: { message?: string | null } | null;
    }>;
    verifyBackupCode: (args: { code: string; trustDevice?: boolean }) => Promise<{
      data?: { token?: string | null } | null;
      error?: { message?: string | null } | null;
    }>;
    disable: (args: { password: string }) => Promise<{
      data?: { status?: boolean } | null;
      error?: { message?: string | null } | null;
    }>;
    generateBackupCodes: (args: { password: string }) => Promise<{
      data?: { status?: boolean; backupCodes: string[] } | null;
      error?: { message?: string | null } | null;
    }>;
  };
};

export type ExpoAuthEnableTwoFactorResult = {
  ok: boolean;
  totpURI: string | null;
  backupCodes: string[] | null;
  error: string | null;
};

export type ExpoAuthEnableTwoFactorState = {
  enable: (args: { password: string; issuer?: string }) => Promise<ExpoAuthEnableTwoFactorResult>;
  isEnabling: boolean;
};

export function useExpoAuthEnableTwoFactor(
  authClient: (ExpoBetterAuthClient & TwoFactorClient) | null,
): ExpoAuthEnableTwoFactorState {
  const [isEnabling, setIsEnabling] = useState(false);

  const enable = useCallback(
    async (args: { password: string; issuer?: string }) => {
      if (authClient?.twoFactor?.enable === undefined) {
        return {
          ok: false,
          totpURI: null,
          backupCodes: null,
          error: TWO_FACTOR_UNAVAILABLE_RN,
        };
      }
      setIsEnabling(true);
      try {
        const result = await authClient.twoFactor.enable(args);
        if (result.error) {
          const msg = result.error.message ?? "Could not enable two-factor authentication";
          return { ok: false, totpURI: null, backupCodes: null, error: msg };
        }
        return {
          ok: true,
          totpURI: result.data?.totpURI ?? null,
          backupCodes: result.data?.backupCodes ?? null,
          error: null,
        };
      } catch (err) {
        return {
          ok: false,
          totpURI: null,
          backupCodes: null,
          error: err instanceof Error ? err.message : "Could not enable two-factor authentication",
        };
      } finally {
        setIsEnabling(false);
      }
    },
    [authClient],
  );

  return { enable, isEnabling };
}

export type ExpoAuthVerifyTotpState = {
  verifyTotp: (args: {
    code: string;
    trustDevice?: boolean;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isVerifying: boolean;
};

export function useExpoAuthVerifyTotp(
  authClient: (ExpoBetterAuthClient & TwoFactorClient) | null,
): ExpoAuthVerifyTotpState {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyTotp = useCallback(
    async (args: { code: string; trustDevice?: boolean }) => {
      if (authClient?.twoFactor?.verifyTotp === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE_RN };
      }
      setIsVerifying(true);
      try {
        const result = await authClient.twoFactor.verifyTotp(args);
        if (result.error) {
          return { ok: false, error: result.error.message ?? "Invalid code" };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Invalid code",
        };
      } finally {
        setIsVerifying(false);
      }
    },
    [authClient],
  );

  return { verifyTotp, isVerifying };
}

export type ExpoAuthVerifyBackupCodeState = {
  verifyBackupCode: (args: {
    code: string;
    trustDevice?: boolean;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isVerifying: boolean;
};

export function useExpoAuthVerifyBackupCode(
  authClient: (ExpoBetterAuthClient & TwoFactorClient) | null,
): ExpoAuthVerifyBackupCodeState {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyBackupCode = useCallback(
    async (args: { code: string; trustDevice?: boolean }) => {
      if (authClient?.twoFactor?.verifyBackupCode === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE_RN };
      }
      setIsVerifying(true);
      try {
        const result = await authClient.twoFactor.verifyBackupCode(args);
        if (result.error) {
          return {
            ok: false,
            error: result.error.message ?? "Invalid backup code",
          };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Invalid backup code",
        };
      } finally {
        setIsVerifying(false);
      }
    },
    [authClient],
  );

  return { verifyBackupCode, isVerifying };
}

export type ExpoAuthDisableTwoFactorState = {
  disable: (args: { password: string }) => Promise<{ ok: boolean; error: string | null }>;
  isDisabling: boolean;
};

export function useExpoAuthDisableTwoFactor(
  authClient: (ExpoBetterAuthClient & TwoFactorClient) | null,
): ExpoAuthDisableTwoFactorState {
  const [isDisabling, setIsDisabling] = useState(false);

  const disable = useCallback(
    async (args: { password: string }) => {
      if (authClient?.twoFactor?.disable === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE_RN };
      }
      setIsDisabling(true);
      try {
        const result = await authClient.twoFactor.disable(args);
        if (result.error) {
          return {
            ok: false,
            error: result.error.message ?? "Could not disable two-factor",
          };
        }
        return { ok: true, error: null };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Could not disable two-factor",
        };
      } finally {
        setIsDisabling(false);
      }
    },
    [authClient],
  );

  return { disable, isDisabling };
}

export type ExpoAuthGenerateBackupCodesState = {
  generateBackupCodes: (args: { password: string }) => Promise<{
    ok: boolean;
    backupCodes: string[] | null;
    error: string | null;
  }>;
  isGenerating: boolean;
};

export function useExpoAuthGenerateBackupCodes(
  authClient: (ExpoBetterAuthClient & TwoFactorClient) | null,
): ExpoAuthGenerateBackupCodesState {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBackupCodes = useCallback(
    async (args: { password: string }) => {
      if (authClient?.twoFactor?.generateBackupCodes === undefined) {
        return {
          ok: false,
          backupCodes: null,
          error: TWO_FACTOR_UNAVAILABLE_RN,
        };
      }
      setIsGenerating(true);
      try {
        const result = await authClient.twoFactor.generateBackupCodes(args);
        if (result.error) {
          return {
            ok: false,
            backupCodes: null,
            error: result.error.message ?? "Could not regenerate backup codes",
          };
        }
        return {
          ok: true,
          backupCodes: result.data?.backupCodes ?? null,
          error: null,
        };
      } catch (err) {
        return {
          ok: false,
          backupCodes: null,
          error: err instanceof Error ? err.message : "Could not regenerate backup codes",
        };
      } finally {
        setIsGenerating(false);
      }
    },
    [authClient],
  );

  return { generateBackupCodes, isGenerating };
}

/**
 * Extract the base32 shared secret from an `otpauth://` URI for manual
 * authenticator entry (RN mirror of the web helper). Returns null when
 * absent. RN's URL implementation handles `otpauth://` reliably; the
 * regex fallback covers any runtime that doesn't.
 */
export function extractTotpSecret(totpURI: string): string | null {
  try {
    const url = new URL(totpURI);
    return url.searchParams.get("secret");
  } catch {
    const match = totpURI.match(/[?&]secret=([^&]+)/i);
    const secret = match?.[1];
    return secret === undefined ? null : decodeURIComponent(secret);
  }
}
