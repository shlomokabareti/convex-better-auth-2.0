import type { AuthReadinessState, AuthRuntimeStatus } from "convex-better-auth";
import { useConvexAuth } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

export function useAuthState(authClient: ConvexBetterAuthClient | null): ConvexAuthState {
  if (authClient === null) {
    return {
      isLoaded: false,
      isSignedIn: false,
    };
  }

  const session = authClient.useSession();
  return {
    isLoaded: !session.isPending,
    isSignedIn: session.data !== null && session.data !== undefined,
  };
}

export function useConvexAuthUser(authClient: ConvexBetterAuthClient | null): ConvexAuthUserState {
  if (authClient === null) {
    return {
      user: null,
      isLoaded: false,
      isSignedIn: false,
    };
  }

  const session = authClient.useSession();
  const user = session.data?.user;

  return {
    user:
      user === undefined
        ? null
        : {
            id: user.id,
            username: null,
            fullName: user.name ?? null,
            primaryEmailAddress: {
              emailAddress: user.email,
            },
          },
    isLoaded: !session.isPending,
    isSignedIn: user !== undefined,
  };
}

export function getConvexAuthActions(args: {
  authClient: ConvexBetterAuthClient | null;
  signInPath: string;
  signUpPath: string;
  assignLocation?: (url: string) => void;
}) {
  const assignLocation =
    args.assignLocation ??
    ((url: string) => {
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    });

  return {
    signInSocial: async (options: { provider: string; callbackURL?: string }) => {
      if (args.authClient === null) {
        return;
      }

      await args.authClient.signIn.social({
        provider: options.provider,
        callbackURL: options.callbackURL,
      });
    },
    signOut: async (options?: { redirectUrl?: string }) => {
      if (args.authClient !== null) {
        await args.authClient.signOut({
          fetchOptions: {
            credentials: "include",
          },
        });
      }

      assignLocation(options?.redirectUrl ?? args.signInPath);
    },
    redirectToSignIn: async (options?: { signInForceRedirectUrl?: string }) => {
      assignLocation(options?.signInForceRedirectUrl ?? args.signInPath);
    },
    buildSignUpUrl: () => args.signUpPath,
  };
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

export function AuthSignedInBoundary(args: { auth: ConvexAuthState; children: ReactNode }) {
  return args.auth.isSignedIn ? <>{args.children}</> : null;
}

export function AuthSignedOutBoundary(args: { auth: ConvexAuthState; children: ReactNode }) {
  return args.auth.isLoaded && !args.auth.isSignedIn ? <>{args.children}</> : null;
}

export function AuthLoadingBoundaryView(args: { auth: ConvexAuthState; children: ReactNode }) {
  return args.auth.isLoaded ? null : <>{args.children}</>;
}

export function AuthLoadedBoundaryView(args: { auth: ConvexAuthState; children: ReactNode }) {
  return args.auth.isLoaded ? <>{args.children}</> : null;
}

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

export function ConvexBetterAuthIdentityProvisioner(args: {
  auth: ConvexAuthState;
  currentUser: unknown;
  sessionSubject: string | null;
  provisionCurrentUser: () => Promise<unknown>;
}) {
  const inFlightRef = useRef(false);
  const attemptedSubjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!args.auth.isSignedIn) {
      attemptedSubjectRef.current = null;
      return;
    }

    if (
      !args.auth.isLoaded ||
      args.currentUser !== null ||
      args.currentUser === undefined ||
      args.sessionSubject === null
    ) {
      return;
    }

    if (inFlightRef.current || attemptedSubjectRef.current === args.sessionSubject) {
      return;
    }

    inFlightRef.current = true;
    attemptedSubjectRef.current = args.sessionSubject;
    void args.provisionCurrentUser().finally(() => {
      inFlightRef.current = false;
    });
  }, [args]);

  return null;
}

// ── Session management hooks (PR A of #3) ─────────────────────────────
//
// Three hooks the package exposes to consumers AND that the upcoming
// ConvexSessionList + ConvexProfileEditForm components consume
// internally. Web-first; RN exports symmetric hooks via runtime.tsx.

export type ConvexAuthSessionListState = {
  /** All active sessions for the current user. null until loaded. */
  sessions: ConvexAuthSessionListItem[] | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the list (e.g. after a revoke). */
  refetch: () => Promise<void>;
};

export function useConvexAuthSessionList(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthSessionListState {
  const [sessions, setSessions] = useState<ConvexAuthSessionListItem[] | null>(null);
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

export type ConvexAuthRevokeSessionState = {
  revokeSession: (args: { token: string }) => Promise<{ ok: boolean; error: string | null }>;
  revokeOtherSessions: () => Promise<{ ok: boolean; error: string | null }>;
  isRevoking: boolean;
};

export function useConvexAuthRevokeSession(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthRevokeSessionState {
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

export type ConvexAuthUpdateProfileState = {
  updateProfile: (args: {
    name?: string;
    image?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isUpdating: boolean;
};

export function useConvexAuthUpdateProfile(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthUpdateProfileState {
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

// ---- Password-recovery hooks (PR D) ----

export type ConvexAuthForgotPasswordState = {
  /**
   * Request a password-reset email. The token in the email links to a
   * page that calls `useConvexAuthResetPassword().resetPassword(...)`.
   * `redirectTo` is the absolute URL of that reset page on this app.
   */
  requestReset: (args: {
    email: string;
    redirectTo?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isRequesting: boolean;
};

export function useConvexAuthForgotPassword(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthForgotPasswordState {
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

export type ConvexAuthResetPasswordState = {
  /**
   * Complete a password reset using a token from the recovery email.
   * The token is typically in the URL search params on the reset page.
   */
  resetPassword: (args: {
    newPassword: string;
    token: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isResetting: boolean;
};

export function useConvexAuthResetPassword(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthResetPasswordState {
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

// ---- Email-verification hooks ----

export type ConvexAuthVerifyEmailStatus = "idle" | "verifying" | "verified" | "error";

export type ConvexAuthVerifyEmailState = {
  status: ConvexAuthVerifyEmailStatus;
  error: string | null;
  verifyEmail: (args: { token: string }) => Promise<{ ok: boolean; error: string | null }>;
};

export function useConvexAuthVerifyEmail(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthVerifyEmailState {
  const [status, setStatus] = useState<ConvexAuthVerifyEmailStatus>("idle");
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

export type ConvexAuthResendVerificationState = {
  resend: (args: {
    email: string;
    callbackURL?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isResending: boolean;
};

export function useConvexAuthResendVerification(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthResendVerificationState {
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

// ---- Email-change hooks ----

export type ConvexAuthChangeEmailState = {
  requestChange: (args: {
    newEmail: string;
    callbackURL?: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isRequesting: boolean;
};

export function useConvexAuthChangeEmail(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthChangeEmailState {
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

// ---- Profile image upload hook ----
//
// The package owns the orchestration (pick → upload → save), but the
// `uploadFile` strategy is consumer-provided so the package stays
// storage-agnostic. The canonical Convex implementation is a thin
// wrapper around `ctx.storage.generateUploadUrl()` + a POST; the
// package keeps that wiring out of the auth surface so consumers
// can swap storage without touching auth.

export type ConvexAuthUploadProfileImageState = {
  /**
   * Pick a file → upload via the provided strategy → write the
   * resulting URL onto the user's image. The whole flow flips a
   * single `isUploading` flag so consumers don't have to thread
   * three booleans.
   */
  uploadAndSave: (
    file: File | Blob,
  ) => Promise<{ ok: boolean; url: string | null; error: string | null }>;
  isUploading: boolean;
};

export function useConvexAuthUploadProfileImage(
  authClient: ConvexBetterAuthClient | null,
  options: { uploadFile: (file: File | Blob) => Promise<string> },
): ConvexAuthUploadProfileImageState {
  const [isUploading, setIsUploading] = useState(false);
  const { uploadFile } = options;

  const uploadAndSave = useCallback(
    async (file: File | Blob) => {
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

// ---- Two-factor (TOTP + backup codes) hooks ----
//
// Five guarded hooks covering the full 2FA surface: enroll, confirm
// (TOTP), confirm (backup code), disable, regenerate backup codes. Each
// returns `{ ok, error }` (plus enroll's `totpURI`/`backupCodes`) and a
// single in-flight boolean, identical in spirit to the password-recovery
// and session hooks above. When the auth client has no `twoFactor`
// namespace (plugin not wired), every hook returns a clear unavailable
// error instead of throwing.

const TWO_FACTOR_UNAVAILABLE = "Two-factor authentication is not available on this auth client";

export type ConvexAuthEnableTwoFactorResult = {
  ok: boolean;
  /** otpauth:// URI to render as a QR code. null on failure. */
  totpURI: string | null;
  /** One-time recovery codes. Show ONCE — never retrievable again. */
  backupCodes: string[] | null;
  error: string | null;
};

export type ConvexAuthEnableTwoFactorState = {
  /**
   * Begin enrollment: re-authenticates with the password, then returns
   * the otpauth URI + backup codes. 2FA is not yet active — the user
   * must confirm a TOTP code via `useConvexAuthVerifyTotp` first.
   */
  enable: (args: { password: string; issuer?: string }) => Promise<ConvexAuthEnableTwoFactorResult>;
  isEnabling: boolean;
};

export function useConvexAuthEnableTwoFactor(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthEnableTwoFactorState {
  const [isEnabling, setIsEnabling] = useState(false);

  const enable = useCallback(
    async (args: { password: string; issuer?: string }) => {
      if (authClient?.twoFactor?.enable === undefined) {
        return {
          ok: false,
          totpURI: null,
          backupCodes: null,
          error: TWO_FACTOR_UNAVAILABLE,
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

export type ConvexAuthVerifyTotpState = {
  /**
   * Confirm a 6-digit TOTP code. Used BOTH to finish enrollment and to
   * satisfy the 2FA step-up during sign-in. `trustDevice` skips 2FA on
   * this device for the Better Auth trust window.
   */
  verifyTotp: (args: {
    code: string;
    trustDevice?: boolean;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isVerifying: boolean;
};

export function useConvexAuthVerifyTotp(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthVerifyTotpState {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyTotp = useCallback(
    async (args: { code: string; trustDevice?: boolean }) => {
      if (authClient?.twoFactor?.verifyTotp === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE };
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

export type ConvexAuthVerifyBackupCodeState = {
  /** Satisfy 2FA step-up with a one-time backup code instead of TOTP. */
  verifyBackupCode: (args: {
    code: string;
    trustDevice?: boolean;
  }) => Promise<{ ok: boolean; error: string | null }>;
  isVerifying: boolean;
};

export function useConvexAuthVerifyBackupCode(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthVerifyBackupCodeState {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyBackupCode = useCallback(
    async (args: { code: string; trustDevice?: boolean }) => {
      if (authClient?.twoFactor?.verifyBackupCode === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE };
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

export type ConvexAuthDisableTwoFactorState = {
  /** Turn 2FA off. Requires re-authentication with the password. */
  disable: (args: { password: string }) => Promise<{ ok: boolean; error: string | null }>;
  isDisabling: boolean;
};

export function useConvexAuthDisableTwoFactor(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthDisableTwoFactorState {
  const [isDisabling, setIsDisabling] = useState(false);

  const disable = useCallback(
    async (args: { password: string }) => {
      if (authClient?.twoFactor?.disable === undefined) {
        return { ok: false, error: TWO_FACTOR_UNAVAILABLE };
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

export type ConvexAuthGenerateBackupCodesState = {
  /**
   * Regenerate the one-time recovery codes (invalidates the old set).
   * Requires re-authentication with the password.
   */
  generateBackupCodes: (args: { password: string }) => Promise<{
    ok: boolean;
    backupCodes: string[] | null;
    error: string | null;
  }>;
  isGenerating: boolean;
};

export function useConvexAuthGenerateBackupCodes(
  authClient: ConvexBetterAuthClient | null,
): ConvexAuthGenerateBackupCodesState {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateBackupCodes = useCallback(
    async (args: { password: string }) => {
      if (authClient?.twoFactor?.generateBackupCodes === undefined) {
        return { ok: false, backupCodes: null, error: TWO_FACTOR_UNAVAILABLE };
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
 * Extract the base32 shared secret from an `otpauth://` URI so the
 * enroll UI can offer manual entry as a fallback to scanning the QR.
 * Returns null if the URI has no `secret` param.
 */
export function extractTotpSecret(totpURI: string): string | null {
  try {
    const url = new URL(totpURI);
    return url.searchParams.get("secret");
  } catch {
    // Some authenticator URIs aren't strictly URL-parseable; fall back
    // to a regex scrape of the secret query param.
    const match = totpURI.match(/[?&]secret=([^&]+)/i);
    const secret = match?.[1];
    return secret === undefined ? null : decodeURIComponent(secret);
  }
}
