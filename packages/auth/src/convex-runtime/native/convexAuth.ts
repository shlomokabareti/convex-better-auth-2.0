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
import type { NativeMagicLinkConfig, NativeMagicLinkFunctionReferences } from "./magicLink.js";
import { nativeEmailOtp } from "./emailOtp.js";
import type { NativeEmailOtpConfig, NativeEmailOtpFunctionReferences } from "./emailOtp.js";
import type { NativeEmailAndPasswordComponentHandle } from "./types.js";

type ConvexAuthConfigBase = {
  emailAndPassword?: NativeEmailAndPasswordConfig;
  oauth?: NativeOAuthConfig;
  magicLink?: NativeMagicLinkConfig;
  emailOtp?: NativeEmailOtpConfig;
};

export type ConvexAuthConfig =
  | (ConvexAuthConfigBase & {
      component: NativeEmailAndPasswordComponentHandle;
      components?: never;
    })
  | (ConvexAuthConfigBase & {
      components: {
        core: NativeEmailAndPasswordComponentHandle;
      };
      component?: never;
    });

export type ConvexAuth = NativeEmailAndPasswordFunctionReferences &
  NativeMagicLinkFunctionReferences &
  NativeEmailOtpFunctionReferences &
  NativeAuthQueries & {
    signInWithRedirect?: NativeOAuthFunctionReferences["signIn"];
    callback?: NativeOAuthFunctionReferences["callback"];
    addHttpRoutes(http: HttpRouter): void;
  };

export function convexAuth(config: ConvexAuthConfig): ConvexAuth {
  const component =
    config.component ?? config.components?.core;
  if (!component) {
    throw new Error(
      "convexAuth: either config.component or config.components.core is required.",
    );
  }

  const emailAndPasswordActions = nativeEmailAndPassword(component, config.emailAndPassword);
  const authQueries = nativeAuthQueries(component);
  const magicLinkActions = config.magicLink
    ? nativeMagicLink(component, config.magicLink)
    : undefined;
  const emailOtpActions = config.emailOtp
    ? nativeEmailOtp(component, config.emailOtp)
    : undefined;

  const oauthActions = config.oauth ? nativeOAuth(component, config.oauth) : undefined;

  const auth = {
    ...emailAndPasswordActions,
    ...magicLinkActions,
    ...emailOtpActions,
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
      const httpActions = magicLinkActions
        ? ({
            ...emailAndPasswordActions,
            ...magicLinkActions,
          } as unknown as NativeEmailAndPasswordFunctionReferences &
            Partial<NativeMagicLinkFunctionReferences>)
        : (emailAndPasswordActions as unknown as NativeEmailAndPasswordFunctionReferences &
            Partial<NativeMagicLinkFunctionReferences>);

      addNativeAuthHttpRoutes(http, component, httpActions, { trustedOrigins });
      if (oauthActions && config.oauth) {
        addNativeOAuthHttpRoutes(http, {
          component,
          oauth: config.oauth,
          trustedOrigins,
        });
      }
    },
  };

  return auth as unknown as ConvexAuth;
}
