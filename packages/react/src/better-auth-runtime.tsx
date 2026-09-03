import type { AuthReadinessState, AuthRuntimeStatus } from "convex-auth-core";
import { useConvexAuth } from "convex/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  AuthSignInForm,
  AuthSignUpForm,
  type AuthFormClassNames,
  type AuthProviderOption,
} from "./auth-forms";
import { AuthRuntimeProvider } from "./AuthRuntimeProvider";
import {
  createBetterAuthConvexTokenCache,
  fetchBetterAuthConvexBearerToken,
  type BetterAuthConvexTokenFetchOptions,
} from "./better-auth-convex-token";
export type { BetterAuthConvexTokenFetchOptions } from "./better-auth-convex-token";
import { BetterAuthConvexProvider } from "./BetterAuthConvexProvider";
import {
  getAuthRuntimeTransitionEvent,
  getAuthTokenRefreshFailureEvent,
} from "./runtime-observability";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthCardContent,
  AuthCardHeader,
  AuthField,
  AuthInput,
  AuthLabel,
} from "./ui";
import { useConvexAuthVerifyBackupCode, useConvexAuthVerifyTotp } from "./auth-client-hooks";

export * from "./auth-client-hooks";

export type ConvexClientLike = {
  setAuth(fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>): void;
  clearAuth(): void;
};

export type BetterAuthUser = {
  id: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  name?: string | null;
};

export type BetterAuthSession = {
  id: string;
  token?: string | null;
};

export type BetterAuthSessionState = {
  data?: {
    session: BetterAuthSession;
    user: BetterAuthUser;
  } | null;
  error?: Error | null;
  isPending: boolean;
  isRefetching?: boolean;
};

export type BetterAuthResponse = {
  // When two-factor is enabled for the account, sign-in does NOT
  // complete — Better Auth returns `data.twoFactorRedirect: true` and
  // sets a short-lived 2FA-pending cookie. Consumers check this flag to
  // route into <ConvexVerifyTwoFactorForm>. Absent on every non-2FA flow.
  //
  // The `& Record<string, unknown>` is load-bearing: the real Better
  // Auth `signIn.email` success payload carries `{ token, redirect, url,
  // … }`, so a narrow `{ twoFactorRedirect?: boolean }` would make the
  // real client NON-assignable to ConvexBetterAuthClient (every consumer
  // casts to this type). Keeping it open keeps the cast valid while
  // still surfacing the one field we care about. See the assignability
  // proof in packages/convex-auth (better-auth-client-contract.test.ts).
  data?: ({ twoFactorRedirect?: boolean } & Record<string, unknown>) | null;
  error: {
    message?: string | null;
  } | null;
};

export type BetterAuthConvexTokenResponse = {
  data?: {
    token?: string | null;
  } | null;
};

export type ConvexBetterAuthClient = {
  useSession(): BetterAuthSessionState;
  signOut(args?: { fetchOptions?: Omit<RequestInit, "body"> & { body?: never } }): Promise<unknown>;
  signIn: {
    email(args: {
      email: string;
      password: string;
      callbackURL?: string;
    }): Promise<BetterAuthResponse>;
    social(args: { provider: string; callbackURL?: string }): Promise<BetterAuthResponse>;
  };
  signUp: {
    email(args: {
      name: string;
      email: string;
      password: string;
      callbackURL?: string;
    }): Promise<BetterAuthResponse>;
  };
  convex?: {
    token(args?: {
      fetchOptions?: BetterAuthConvexTokenFetchOptions;
    }): Promise<BetterAuthConvexTokenResponse>;
  };
  // Session-management surface (PR A of #3). All OPTIONAL because not
  // every consumer cast of this type provides them — the package's
  // session hooks return null/no-op if the methods are absent.
  listSessions?: () => Promise<{
    data?: ConvexAuthSessionListItem[] | null;
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
  // Password-recovery surface. Optional like the session methods —
  // any auth client that doesn't expose these makes the corresponding
  // hooks return a clear "not available" error rather than crashing.
  forgetPassword?: (args: { email: string; redirectTo?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  resetPassword?: (args: { newPassword: string; token: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  // Email-verification surface. `sendVerificationEmail` is optional;
  // some flows fire verification automatically server-side at sign-up
  // and never call this client method. `verifyEmail` consumes the
  // token from the verification email link.
  sendVerificationEmail?: (args: { email: string; callbackURL?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  verifyEmail?: (args: { query: { token: string } }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  // Email-change surface. Sends a verification email to the NEW
  // address; once that link is clicked (which goes through the same
  // verifyEmail flow), the user's email is updated.
  changeEmail?: (args: { newEmail: string; callbackURL?: string }) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
  // Two-factor (TOTP + backup codes) surface. Present only when the
  // auth client was built with Better Auth's `twoFactorClient` plugin
  // (the package's client factories add it automatically). Optional like
  // every other method group — hooks return a clear "not available"
  // error rather than crashing when it's absent.
  twoFactor?: ConvexBetterAuthTwoFactorApi;
};

// Method shapes mirror Better Auth's `twoFactorClient` plugin exactly
// (better-auth/plugins two-factor). `enable` returns the otpauth URI +
// one-time backup codes; the user is NOT fully enrolled until a TOTP
// code is confirmed via `verifyTotp`.
export type ConvexBetterAuthTwoFactorApi = {
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

// Public shape of one entry returned by listSessions. Mirrors
// Better-Auth's Session row, minus internals consumers shouldn't depend on.
export type ConvexAuthSessionListItem = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ConvexAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
};

export type ConvexAuthSocialProvider = {
  provider: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type ConvexAuthUserState = {
  user: {
    id: string;
    username: string | null;
    fullName: string | null;
    primaryEmailAddress: {
      emailAddress: string;
    } | null;
  } | null;
  isLoaded: boolean;
  // Convenience boolean — equivalent to `user !== null` once `isLoaded`
  // is true. Added so consumers don't need to combine useAppUser +
  // useAppAuth just to make routing decisions. Caught by pile P5b where
  // `const { isSignedIn } = useAppUser()` silently destructured a
  // non-existent field, making route-guard context evaluation a no-op.
  isSignedIn: boolean;
};

export type ConvexAuthRuntimeWindow = Window & {
  __authRuntime?: {
    getConvexToken: (args?: { forceRefreshToken?: boolean }) => Promise<string | null>;
  };
};

export type ConvexAuthCaptureException = (
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: "warning" | "error";
  },
) => void;

export async function getBetterAuthConvexBearerToken(args: {
  authClient?: Pick<ConvexBetterAuthClient, "convex"> | null;
  betterAuthBaseUrl?: string | null;
  fetchImpl?: typeof fetch;
  cachedToken?: string | null;
  forceRefreshToken?: boolean;
}): Promise<string | null> {
  return await fetchBetterAuthConvexBearerToken(args);
}

export function ConvexAuthRuntimeProvider(args: {
  children: ReactNode;
  convex: ConvexClientLike;
  authClient: ConvexBetterAuthClient | null;
  betterAuthBaseUrl?: string | null;
  captureAuthEvent?: (
    eventName: string,
    properties: { surface: "runtime" } & Record<string, unknown>,
  ) => void;
  captureException?: ConvexAuthCaptureException;
  identityProvisioner?: ReactNode;
}) {
  const runtimeTokenCache = useRef<ReturnType<typeof createBetterAuthConvexTokenCache> | null>(
    null,
  );
  const runtimeTokenCacheAuthClientRef = useRef<typeof args.authClient | undefined>(undefined);
  const runtimeTokenCacheBaseUrlRef = useRef<string | null | undefined>(undefined);

  if (
    runtimeTokenCache.current === null ||
    runtimeTokenCacheAuthClientRef.current !== args.authClient ||
    runtimeTokenCacheBaseUrlRef.current !== args.betterAuthBaseUrl
  ) {
    runtimeTokenCacheAuthClientRef.current = args.authClient;
    runtimeTokenCacheBaseUrlRef.current = args.betterAuthBaseUrl;
    runtimeTokenCache.current = createBetterAuthConvexTokenCache({
      fetchFreshToken: async ({ cachedToken, forceRefreshToken }) =>
        await getBetterAuthConvexBearerToken({
          authClient: args.authClient,
          betterAuthBaseUrl: args.betterAuthBaseUrl,
          cachedToken,
          forceRefreshToken,
        }),
      onTokenRefreshFailure: (failure) => {
        const refreshFailureEvent = getAuthTokenRefreshFailureEvent(failure);
        args.captureAuthEvent?.(refreshFailureEvent.eventName, refreshFailureEvent.properties);
        args.captureException?.(failure.error, {
          level: "warning",
          tags: {
            area: "auth-runtime",
            event: refreshFailureEvent.eventName,
          },
          extra: refreshFailureEvent.properties,
        });
      },
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const runtimeWindow = window as ConvexAuthRuntimeWindow;
    runtimeWindow.__authRuntime = {
      getConvexToken: async (options) =>
        (await runtimeTokenCache.current?.getToken({
          forceRefreshToken: options?.forceRefreshToken ?? false,
        })) ?? null,
    };

    return () => {
      delete runtimeWindow.__authRuntime;
    };
  }, [args.authClient, args.betterAuthBaseUrl]);

  if (args.authClient === null) {
    return (
      <AuthRuntimeProvider status={SIGNED_OUT_RUNTIME_STATUS}>{args.children}</AuthRuntimeProvider>
    );
  }

  return (
    <BetterAuthConvexProvider authClient={args.authClient} client={args.convex}>
      <ObservedAuthRuntimeStatusProvider
        authClient={args.authClient}
        captureAuthEvent={args.captureAuthEvent}
      >
        {args.identityProvisioner}
        {args.children}
      </ObservedAuthRuntimeStatusProvider>
    </BetterAuthConvexProvider>
  );
}

const SIGNED_OUT_RUNTIME_STATUS: AuthRuntimeStatus = {
  state: "signedOut",
  providerAuthenticated: false,
  tokenAvailable: false,
  convexAuthenticated: false,
  isRecovering: false,
  reauthRequired: false,
};

function ObservedAuthRuntimeStatusProvider(args: {
  children: ReactNode;
  authClient: ConvexBetterAuthClient;
  captureAuthEvent?: (
    eventName: string,
    properties: { surface: "runtime" } & Record<string, unknown>,
  ) => void;
}) {
  const { authClient, captureAuthEvent, children } = args;
  const session = authClient.useSession();
  const convexAuth = useConvexAuth();
  const previousStatusRef = useRef<AuthRuntimeStatus | null>(null);

  const status = useMemo(
    () =>
      createRuntimeStatus({
        providerAuthenticated: session.data !== null && session.data !== undefined,
        providerLoading: session.isPending,
        tokenAvailable:
          session.data?.session.token !== undefined && session.data?.session.token !== null,
        convexAuthenticated: convexAuth.isAuthenticated,
        terminalFailure: session.error !== null && session.error !== undefined,
        recovering:
          (session.isRefetching ?? false) ||
          (session.data !== null && session.data !== undefined && convexAuth.isLoading),
      }),
    [
      convexAuth.isAuthenticated,
      convexAuth.isLoading,
      session.data,
      session.error,
      session.isPending,
      session.isRefetching,
    ],
  );

  useEffect(() => {
    const transitionEvent = getAuthRuntimeTransitionEvent(previousStatusRef.current, status);
    if (transitionEvent !== null) {
      captureAuthEvent?.(transitionEvent.eventName, transitionEvent.properties);
    }
    previousStatusRef.current = status;
  }, [captureAuthEvent, status]);

  return <AuthRuntimeProvider status={status}>{children}</AuthRuntimeProvider>;
}

function createRuntimeStatus(args: {
  providerAuthenticated: boolean;
  providerLoading: boolean;
  tokenAvailable: boolean;
  convexAuthenticated: boolean;
  terminalFailure: boolean;
  recovering: boolean;
}): AuthRuntimeStatus {
  return {
    state: mapRuntimeReadiness(args),
    providerAuthenticated: args.providerAuthenticated,
    tokenAvailable: args.tokenAvailable,
    convexAuthenticated: args.convexAuthenticated,
    isRecovering: args.recovering,
    reauthRequired: args.terminalFailure,
  };
}

function mapRuntimeReadiness(args: {
  providerAuthenticated: boolean;
  providerLoading: boolean;
  tokenAvailable: boolean;
  convexAuthenticated: boolean;
  terminalFailure: boolean;
  recovering: boolean;
}): AuthReadinessState {
  if (args.terminalFailure) {
    return "reauthRequired";
  }

  if (args.providerLoading) {
    return args.providerAuthenticated ? "providerReady" : "providerLoading";
  }

  if (!args.providerAuthenticated) {
    return args.recovering ? "degraded" : "signedOut";
  }

  if (!args.tokenAvailable) {
    return args.recovering ? "tokenRefreshing" : "providerReady";
  }

  if (!args.convexAuthenticated) {
    return args.recovering ? "convexConnecting" : "tokenReady";
  }

  return "convexReady";
}

export function toAuthProviderOptions(
  socialProviders: readonly ConvexAuthSocialProvider[] | undefined,
): readonly AuthProviderOption[] | undefined {
  if (socialProviders === undefined || socialProviders.length === 0) {
    return undefined;
  }

  return socialProviders.map((provider) => ({
    id: provider.provider,
    label: provider.label,
    disabled: provider.disabled,
  }));
}

export * from "./auth-client-boundaries";

export function AuthFailedBoundaryView(args: {
  authClient: ConvexBetterAuthClient | null;
  children: ReactNode;
}) {
  return args.authClient === null ? <>{args.children}</> : null;
}

export function ConvexAuthSignInScreen(args: {
  authClient: ConvexBetterAuthClient | null;
  signUpUrl: string;
  forceRedirectUrl: string;
  /** When set, AuthSignInForm renders a forgot-password link to this href. */
  forgotPasswordHref?: string;
  description?: string;
  title?: string;
  missingConfigLabel?: string;
  classNames?: AuthFormClassNames;
  socialProviders?: readonly ConvexAuthSocialProvider[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // When 2FA is enabled for the account, signIn.email does NOT complete
  // — it returns `data.twoFactorRedirect` and the session stays pending.
  // We render the inline step-up instead of redirecting; without this a
  // 2FA-enabled user would be bounced straight back to sign-in.
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  if (args.authClient === null) {
    return (
      <AuthAlert tone="error" title="Better Auth misconfigured">
        Missing <code>{args.missingConfigLabel ?? "VITE_BETTER_AUTH_URL"}</code>. This app cannot
        render Better Auth sign-in without provider base URL.
      </AuthAlert>
    );
  }
  const authClient = args.authClient;
  const providerOptions = toAuthProviderOptions(args.socialProviders);

  if (twoFactorPending) {
    return (
      <ConvexInlineTwoFactorStepUp
        authClient={authClient}
        onVerified={() => {
          if (typeof window !== "undefined") {
            window.location.assign(args.forceRedirectUrl);
          }
        }}
      />
    );
  }

  return (
    <AuthSignInForm
      classNames={args.classNames}
      description={args.description ?? "Access your workspace with the shared authentication flow."}
      error={error}
      forgotPasswordHref={args.forgotPasswordHref}
      providers={providerOptions}
      onProviderSelect={
        providerOptions === undefined
          ? undefined
          : async (providerId) => {
              setError(null);
              await authClient.signIn.social({
                provider: providerId,
                callbackURL: args.forceRedirectUrl,
              });
            }
      }
      footer={
        <>
          Need an account?{" "}
          <a className="text-muted-foreground hover:text-foreground" href={args.signUpUrl}>
            Create one
          </a>
        </>
      }
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        setIsSubmitting(true);
        setError(null);

        const response = await authClient.signIn.email({
          email: values.email,
          password: values.password,
          callbackURL: args.forceRedirectUrl,
        });

        setIsSubmitting(false);

        if (response.error !== null) {
          setError(response.error.message ?? "Sign-in failed.");
          return;
        }

        // Sign-in succeeded at the password layer but 2FA is required:
        // swap to the step-up instead of redirecting into a session that
        // isn't actually authenticated yet.
        if (response.data?.twoFactorRedirect === true) {
          setTwoFactorPending(true);
          return;
        }

        if (typeof window !== "undefined") {
          window.location.assign(args.forceRedirectUrl);
        }
      }}
      submitLabel="Sign in"
      submittingLabel="Signing in..."
      title={args.title ?? "Sign in"}
    />
  );
}

// Inline 2FA step-up rendered by ConvexAuthSignInScreen when sign-in
// returns `twoFactorRedirect`. Lives here (not as the standalone
// ConvexVerifyTwoFactorForm) purely to avoid a circular import: the
// standalone component imports this module's hooks, so this module
// can't import it back. Behavior is identical — TOTP or backup code,
// optional trust-device.
function ConvexInlineTwoFactorStepUp(args: {
  authClient: ConvexBetterAuthClient;
  onVerified: () => void;
}) {
  const { verifyTotp, isVerifying: isVerifyingTotp } = useConvexAuthVerifyTotp(args.authClient);
  const { verifyBackupCode, isVerifying: isVerifyingBackup } = useConvexAuthVerifyBackupCode(
    args.authClient,
  );
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVerifying = isVerifyingTotp || isVerifyingBackup;

  return (
    <AuthCard>
      <AuthCardHeader
        title="Two-factor authentication"
        description={
          mode === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Enter one of your backup codes."
        }
      />
      <AuthCardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            const trimmed = code.trim();
            if (trimmed.length === 0) return;
            const result =
              mode === "totp"
                ? await verifyTotp({ code: trimmed, trustDevice })
                : await verifyBackupCode({ code: trimmed, trustDevice });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            args.onVerified();
          }}
        >
          <AuthField>
            <AuthLabel htmlFor="convex-signin-2fa-code">
              {mode === "totp" ? "Authentication code" : "Backup code"}
            </AuthLabel>
            <AuthInput
              id="convex-signin-2fa-code"
              inputMode={mode === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              value={code}
              placeholder={mode === "totp" ? "123456" : "xxxxx-xxxxx"}
              onChange={(e) => setCode(e.currentTarget.value)}
              required
            />
          </AuthField>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.currentTarget.checked)}
            />
            Trust this device for 60 days
          </label>
          <AuthButton type="submit" disabled={isVerifying}>
            {isVerifying ? "Verifying…" : "Verify"}
          </AuthButton>
          <AuthButton
            type="button"
            variant="ghost"
            onClick={() => {
              setMode(mode === "totp" ? "backup" : "totp");
              setCode("");
              setError(null);
            }}
          >
            {mode === "totp" ? "Use a backup code" : "Use authenticator app"}
          </AuthButton>
          {error !== null ? <AuthAlert tone="error">{error}</AuthAlert> : null}
        </form>
      </AuthCardContent>
    </AuthCard>
  );
}

export function ConvexAuthSignUpScreen(args: {
  authClient: ConvexBetterAuthClient | null;
  signInUrl: string;
  forceRedirectUrl: string;
  description?: string;
  title?: string;
  missingConfigLabel?: string;
  classNames?: AuthFormClassNames;
  socialProviders?: readonly ConvexAuthSocialProvider[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (args.authClient === null) {
    return (
      <AuthAlert tone="error" title="Better Auth misconfigured">
        Missing <code>{args.missingConfigLabel ?? "VITE_BETTER_AUTH_URL"}</code>. This app cannot
        render Better Auth sign-up without provider base URL.
      </AuthAlert>
    );
  }
  const authClient = args.authClient;
  const providerOptions = toAuthProviderOptions(args.socialProviders);

  return (
    <AuthSignUpForm
      classNames={args.classNames}
      description={args.description ?? "Create your account, then continue into setup."}
      error={error}
      providers={providerOptions}
      onProviderSelect={
        providerOptions === undefined
          ? undefined
          : async (providerId) => {
              setError(null);
              await authClient.signIn.social({
                provider: providerId,
                callbackURL: args.forceRedirectUrl,
              });
            }
      }
      footer={
        <>
          Already have an account?{" "}
          <a className="text-muted-foreground hover:text-foreground" href={args.signInUrl}>
            Sign in
          </a>
        </>
      }
      isSubmitting={isSubmitting}
      onSubmit={async (values) => {
        setIsSubmitting(true);
        setError(null);

        const response = await authClient.signUp.email({
          name: values.name,
          email: values.email,
          password: values.password,
          callbackURL: args.forceRedirectUrl,
        });

        setIsSubmitting(false);

        if (response.error !== null) {
          setError(response.error.message ?? "Sign-up failed.");
          return;
        }

        if (typeof window !== "undefined") {
          window.location.assign(args.forceRedirectUrl);
        }
      }}
      submitLabel="Create account"
      submittingLabel="Creating account..."
      title={args.title ?? "Create account"}
    />
  );
}

export { ConvexAuthIdentityProvisioner as ConvexBetterAuthIdentityProvisioner } from "./auth-client-identity-provisioner";
