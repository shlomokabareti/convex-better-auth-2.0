/**
 * Public client types shared by the native and Better Auth runtimes.
 *
 * Currently re-exported from `better-auth-runtime` for a single source of
 * truth. The re-export is type-only and does not pull Better Auth into the
 * native client bundle.
 */
export type {
  BetterAuthUser,
  BetterAuthSession,
  BetterAuthSessionState,
  BetterAuthResponse,
  BetterAuthConvexTokenResponse,
  BetterAuthConvexTokenFetchOptions,
  ConvexBetterAuthClient,
  ConvexBetterAuthTwoFactorApi,
  ConvexAuthSessionListItem,
  ConvexAuthState,
  ConvexAuthSocialProvider,
  ConvexAuthUserState,
  ConvexAuthRuntimeWindow,
  ConvexAuthCaptureException,
} from "./better-auth-runtime";
