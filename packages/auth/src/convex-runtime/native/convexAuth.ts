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
import { nativeAuthQueries, type NativeAuthQueries } from "./queries.js";
import { nativeMagicLink } from "./magicLink.js";
import type {
  NativeMagicLinkConfig,
  NativeMagicLinkFunctionReferences,
} from "./magicLink.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

export type ConvexAuthConfig = {
  component: NativeEmailAndPasswordComponentHandle;
  emailAndPassword?: NativeEmailAndPasswordConfig;
  oauth?: NativeOAuthConfig;
  magicLink?: NativeMagicLinkConfig;
};

export type ConvexAuth = NativeEmailAndPasswordFunctionReferences &
  NativeMagicLinkFunctionReferences &
  NativeAuthQueries & {
    signInWithRedirect?: NativeOAuthFunctionReferences["signIn"];
    callback?: NativeOAuthFunctionReferences["callback"];
    addHttpRoutes(http: HttpRouter): void;
  };

export function convexAuth(config: ConvexAuthConfig): ConvexAuth {
  const emailAndPasswordActions = nativeEmailAndPassword(config.component, config.emailAndPassword);
  const authQueries = nativeAuthQueries(config.component);
  const magicLinkActions = config.magicLink
    ? nativeMagicLink(config.component, config.magicLink)
    : undefined;

  const oauthActions = config.oauth ? nativeOAuth(config.component, config.oauth) : undefined;

  const auth = {
    ...emailAndPasswordActions,
    ...(magicLinkActions ?? {}),
    ...authQueries,
    ...(oauthActions
      ? { signInWithRedirect: oauthActions.signIn, callback: oauthActions.callback }
      : {}),
    addHttpRoutes(http: HttpRouter) {
      const emailConfig = config.emailAndPassword ?? {};
      const trustedOrigins = [
        ...(emailConfig.trustedOrigins ?? []),
        ...(emailConfig.email?.appOrigin ? [emailConfig.email.appOrigin] : []),
        ...(config.oauth?.trustedOrigins ?? []),
        ...(process.env.SITE_URL ? [process.env.SITE_URL] : []),
        ...(process.env.CONVEX_SITE_URL ? [process.env.CONVEX_SITE_URL] : []),
      ];
      addNativeAuthHttpRoutes(
        http,
        config.component,
        emailAndPasswordActions as unknown as NativeEmailAndPasswordFunctionReferences,
        { trustedOrigins },
      );
      if (oauthActions && config.oauth) {
        addNativeOAuthHttpRoutes(http, {
          component: config.component,
          oauth: config.oauth,
          trustedOrigins,
        });
      }
    },
  };

  return auth as unknown as ConvexAuth;
}
