import type { HttpRouter } from "convex/server";
import { addNativeAuthHttpRoutes } from "./http.js";
import { addNativeOAuthHttpRoutes } from "./oauthHttp.js";
import { nativeOAuth } from "./oauthActions.js";
import type { NativeOAuthConfig, NativeOAuthFunctionReferences } from "./oauthActions.js";
import { nativeEmailAndPassword } from "./provider.js";
import type {
  NativeEmailAndPasswordConfig,
  NativeEmailAndPasswordFunctionReferences,
} from "./provider.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

export type ConvexAuthConfig = {
  component: NativeEmailAndPasswordComponentHandle;
  emailAndPassword?: NativeEmailAndPasswordConfig;
  oauth?: NativeOAuthConfig;
};

export type ConvexAuth = NativeEmailAndPasswordFunctionReferences & {
  signInWithRedirect?: NativeOAuthFunctionReferences["signIn"];
  callback?: NativeOAuthFunctionReferences["callback"];
  addHttpRoutes(http: HttpRouter): void;
};

export function convexAuth(config: ConvexAuthConfig): ConvexAuth {
  const emailAndPasswordActions = nativeEmailAndPassword(
    config.component,
    config.emailAndPassword,
  );

  const oauthActions = config.oauth ? nativeOAuth(config.component, config.oauth) : undefined;

  const auth = {
    ...emailAndPasswordActions,
    ...(oauthActions
      ? { signInWithRedirect: oauthActions.signIn, callback: oauthActions.callback }
      : {}),
    addHttpRoutes(http: HttpRouter) {
      addNativeAuthHttpRoutes(
        http,
        config.component,
        emailAndPasswordActions as unknown as NativeEmailAndPasswordFunctionReferences,
      );
      if (oauthActions && config.oauth) {
        addNativeOAuthHttpRoutes(http, { component: config.component, oauth: config.oauth });
      }
    },
  };

  return auth as unknown as ConvexAuth;
}
