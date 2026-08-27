import { convexClient, crossDomainClient } from "convex-better-auth-adapter/client/plugins";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export type BetterAuthClientFactoryOptions = NonNullable<Parameters<typeof createAuthClient>[0]> & {
  customFetchImpl?: typeof fetch;
};

export type BetterAuthClient = ReturnType<typeof createAuthClient>;
export function createBetterAuthClient(options: BetterAuthClientFactoryOptions): BetterAuthClient {
  const { customFetchImpl, fetchOptions, ...rest } = options;

  return createAuthClient({
    ...rest,
    fetchOptions:
      customFetchImpl === undefined
        ? fetchOptions
        : {
            ...fetchOptions,
            customFetchImpl,
          },
  });
}

export function createBetterAuthConvexClient(
  options: BetterAuthClientFactoryOptions,
): BetterAuthClient {
  const plugins = options.plugins ?? [];
  const crossDomainPlugin: BetterAuthClientPlugin = crossDomainClient();
  const convexPlugin: BetterAuthClientPlugin = convexClient();
  // The two-factor client plugin only ADDS the `twoFactor.*` methods +
  // a passive sign-in interceptor that flags `twoFactorRedirect`. It is
  // inert when the server has 2FA disabled, so wiring it unconditionally
  // keeps 2FA a true drop-in without forcing every consumer to opt in.
  const twoFactorPlugin: BetterAuthClientPlugin = twoFactorClient();
  const crossDomainPlugins = plugins.some((plugin) => plugin.id === "cross-domain")
    ? plugins
    : [crossDomainPlugin, ...plugins];
  const convexPlugins = crossDomainPlugins.some((plugin) => plugin.id === "convex")
    ? crossDomainPlugins
    : [...crossDomainPlugins, convexPlugin];
  const authPlugins = convexPlugins.some((plugin) => plugin.id === "two-factor")
    ? convexPlugins
    : [...convexPlugins, twoFactorPlugin];
  return createBetterAuthClient({
    ...options,
    plugins: authPlugins,
  });
}
