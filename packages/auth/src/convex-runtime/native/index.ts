export { convexAuth } from "./convexAuth.js";
export type { ConvexAuth, ConvexAuthConfig } from "./convexAuth.js";
export { nativeEmailAndPassword } from "./provider.js";
export { type NativeEmailAndPasswordActions } from "./provider.js";
export { type EmailDraft, type EmailSender } from "./provider.js";
export { nativeOAuth } from "./oauthActions.js";
export { type NativeOAuthActions } from "./oauthActions.js";
export {
  handleCallback,
  handleSignIn,
  type NativeOAuthCallbackArgs,
  type NativeOAuthCallbackResult,
  type NativeOAuthConfig,
  type NativeOAuthSignInArgs,
} from "./oauthHandlers.js";
export {
  createGitHubProvider,
  createGoogleProvider,
  type GitHubProviderConfig,
  type GoogleProviderConfig,
  type NativeOAuthProvider,
  type OAuthToken,
  type OAuthUserInfo,
} from "./oauth.js";
export {
  generateCodeChallenge,
  generateCodeVerifier,
  mintOAuthState,
  verifyOAuthState,
} from "./oauthState.js";
export { addNativeOAuthHttpRoutes, type NativeOAuthHttpConfig } from "./oauthHttp.js";
export { addNativeAuthHttpRoutes } from "./http.js";
export type { NativeEmailAndPasswordComponentHandle, NativeOAuthComponentHandle } from "./types.js";
