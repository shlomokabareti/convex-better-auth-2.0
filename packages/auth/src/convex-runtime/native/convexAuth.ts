import type { HttpRouter } from "convex/server";
import { addNativeAuthHttpRoutes } from "./http.js";
import { addNativeOAuthHttpRoutes } from "./oauthHttp.js";
import { nativeOAuth } from "./oauthActions.js";
import { nativeEmailAndPassword } from "./provider.js";
import type {
  NativeEmailAndPasswordActions,
  NativeEmailAndPasswordConfig,
} from "./provider.js";
import type { NativeOAuthActions, NativeOAuthConfig } from "./oauthActions.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

export type ConvexAuthConfig = {
  component: NativeEmailAndPasswordComponentHandle;
  emailAndPassword?: NativeEmailAndPasswordConfig;
  oauth?: NativeOAuthConfig;
};

export type ConvexAuth = NativeEmailAndPasswordActions & {
  signInWithRedirect?: NativeOAuthActions["signIn"];
  callback?: NativeOAuthActions["callback"];
  addHttpRoutes(http: HttpRouter): void;
};

export function convexAuth(config: ConvexAuthConfig): ConvexAuth {
  const emailAndPasswordActions = nativeEmailAndPassword(
    config.component,
    config.emailAndPassword,
  );

  const oauthActions = config.oauth ? nativeOAuth(config.component, config.oauth) : undefined;

  const auth: ConvexAuth = {
    ...emailAndPasswordActions,
    ...(oauthActions
      ? { signInWithRedirect: oauthActions.signIn, callback: oauthActions.callback }
      : {}),
    addHttpRoutes(http: HttpRouter) {
      addNativeAuthHttpRoutes(http, config.component);
      if (oauthActions && config.oauth) {
        addNativeOAuthHttpRoutes(http, { component: config.component, oauth: config.oauth });
      }
    },
  };

  return auth;
}
