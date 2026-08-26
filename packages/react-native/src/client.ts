import { expoClient } from "@better-auth/expo/client";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

import {
  resolveVortexExpoAuthClientMode,
  type VortexExpoPlatformOS,
} from "./config";

export type VortexExpoBetterAuthClientFactoryOptions = NonNullable<
  Parameters<typeof createAuthClient>[0]
>;

type VortexExpoRuntimePlugin<
  PlatformOS extends VortexExpoPlatformOS | undefined,
> = PlatformOS extends "web"
  ? ReturnType<typeof crossDomainClient>
  : ReturnType<typeof expoClient>;

type VortexExpoBuiltInPlugin<
  PlatformOS extends VortexExpoPlatformOS | undefined,
> =
  | VortexExpoRuntimePlugin<PlatformOS>
  | ReturnType<typeof convexClient>
  | ReturnType<typeof twoFactorClient>;

type VortexExpoConcreteCustomPlugin<
  Plugins extends readonly BetterAuthClientPlugin[],
> = BetterAuthClientPlugin extends Plugins[number] ? never : Plugins[number];

type VortexExpoBetterAuthClientConfig<
  PlatformOS extends VortexExpoPlatformOS | undefined,
  Plugins extends readonly BetterAuthClientPlugin[],
> = Omit<VortexExpoBetterAuthClientFactoryOptions, "plugins"> & {
  plugins: Array<
    | VortexExpoBuiltInPlugin<PlatformOS>
    | VortexExpoConcreteCustomPlugin<Plugins>
  >;
};

export type VortexExpoBetterAuthClient<
  PlatformOS extends VortexExpoPlatformOS | undefined =
    | VortexExpoPlatformOS
    | undefined,
  Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
> = PlatformOS extends VortexExpoPlatformOS | undefined
  ? ReactAuthClient<VortexExpoBetterAuthClientConfig<PlatformOS, Plugins>>
  : never;

export type VortexExpoSecureStorage = Parameters<
  typeof expoClient
>[0]["storage"];
export type VortexExpoCookiePrefix = Parameters<
  typeof expoClient
>[0]["cookiePrefix"];
export type VortexExpoWebBrowserOptions = Parameters<
  typeof expoClient
>[0]["webBrowserOptions"];

export type VortexExpoBetterAuthClientOptions<
  Plugins extends readonly BetterAuthClientPlugin[] =
    readonly BetterAuthClientPlugin[],
> = Omit<VortexExpoBetterAuthClientFactoryOptions, "plugins"> & {
  cookiePrefix?: VortexExpoCookiePrefix;
  disableCache?: boolean;
  platformOS?: VortexExpoPlatformOS;
  plugins?: Plugins;
  scheme: string;
  storage?: VortexExpoSecureStorage;
  storagePrefix?: string;
  webBrowserOptions?: VortexExpoWebBrowserOptions;
};

export function createVortexExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: VortexExpoBetterAuthClientOptions<Plugins> & { platformOS: "web" }
): VortexExpoBetterAuthClient<"web", Plugins>;
export function createVortexExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: VortexExpoBetterAuthClientOptions<Plugins> & {
    platformOS?: Exclude<VortexExpoPlatformOS, "web">;
  }
): VortexExpoBetterAuthClient<undefined, Plugins>;
export function createVortexExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: VortexExpoBetterAuthClientOptions<Plugins>
): VortexExpoBetterAuthClient<VortexExpoPlatformOS | undefined, Plugins>;
export function createVortexExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(options: VortexExpoBetterAuthClientOptions<Plugins>) {
  const { pluginOptions, clientOptions } =
    splitVortexExpoBetterAuthClientOptions(options);
  const mode = resolveVortexExpoAuthClientMode(pluginOptions);
  const suppliedPlugins = options.plugins ?? [];

  if (mode.kind === "web") {
    const plugins = addVortexExpoBuiltInPlugins(
      suppliedPlugins,
      crossDomainClient()
    );
    return createAuthClient({
      ...clientOptions,
      plugins,
    });
  }

  const plugins = addVortexExpoBuiltInPlugins(
    suppliedPlugins,
    expoClient({
      cookiePrefix: pluginOptions.cookiePrefix,
      disableCache: pluginOptions.disableCache,
      scheme: mode.scheme,
      storage: createDurableCookieFilteredStorage(
        requireVortexExpoSecureStorage(pluginOptions.storage)
      ),
      storagePrefix: mode.storagePrefix,
      webBrowserOptions: pluginOptions.webBrowserOptions,
    })
  );
  return createAuthClient({
    ...clientOptions,
    plugins,
  });
}

function addVortexExpoBuiltInPlugins<
  Plugins extends readonly BetterAuthClientPlugin[],
  RuntimePlugin extends BetterAuthClientPlugin,
>(suppliedPlugins: Plugins, runtimePlugin: RuntimePlugin) {
  const pluginsWithRuntime = addPluginIfMissing({
    plugins: suppliedPlugins,
    plugin: runtimePlugin,
  });
  const pluginsWithConvex = addPluginIfMissing({
    plugins: pluginsWithRuntime,
    plugin: convexClient(),
  });
  // Inert when the server has 2FA off; added unconditionally so 2FA is a
  // drop-in for Expo consumers exactly as it is on the web client.
  return addPluginIfMissing({
    plugins: pluginsWithConvex,
    plugin: twoFactorClient(),
  });
}

function splitVortexExpoBetterAuthClientOptions(
  options: VortexExpoBetterAuthClientOptions
) {
  const {
    cookiePrefix,
    disableCache,
    platformOS,
    scheme,
    storage,
    storagePrefix,
    webBrowserOptions,
    ...clientOptions
  } = options;

  return {
    clientOptions,
    pluginOptions: {
      cookiePrefix,
      disableCache,
      platformOS,
      scheme,
      storage,
      storagePrefix,
      webBrowserOptions,
    },
  };
}

function addPluginIfMissing<
  Plugins extends readonly BetterAuthClientPlugin[],
  Plugin extends BetterAuthClientPlugin,
>(args: { plugins: Plugins; plugin: Plugin }): Array<Plugins[number] | Plugin> {
  return args.plugins.some((plugin) => plugin.id === args.plugin.id)
    ? [...args.plugins]
    : [...args.plugins, args.plugin];
}

/**
 * Only the session token is a DURABLE credential. `session_data` (the
 * cookieCache) and `convex_jwt` are short-lived values the server
 * re-derives from the session token on every request, so persisting
 * them is both pointless and harmful: @better-auth/expo bundles all
 * cookies into ONE iOS Keychain entry, and these two (~830B + ~900B)
 * push it past SecureStore's 2KB ceiling, silently dropping the write
 * and stranding native users on the sign-in screen. We keep only the
 * session token in durable storage (suffix match handles every cookie
 * prefix: `better-auth.` / `__Secure-better-auth.` / custom). The
 * server rebuilds session_data + convex_jwt from it on first use.
 */
const DURABLE_COOKIE_SUFFIXES = ["session_token"] as const;

function isDurableCookieName(cookieName: string): boolean {
  return DURABLE_COOKIE_SUFFIXES.some((suffix) => cookieName.endsWith(suffix));
}

function createDurableCookieFilteredStorage(
  storage: VortexExpoSecureStorage
): VortexExpoSecureStorage {
  return {
    getItem: (name: string) => storage.getItem(name),
    getItemAsync: (name: string) => Promise.resolve(storage.getItem(name)),
    setItem: (name: string, value: string) => {
      // Only the bundled cookie key (`<prefix>_cookie`) is filtered.
      // The separate `<prefix>_session_data` body cache passes through.
      if (!name.endsWith("_cookie")) {
        return storage.setItem(name, value);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        // Unparseable — pass through rather than silently dropping it.
        return storage.setItem(name, value);
      }
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return storage.setItem(name, value);
      }
      const filtered = Object.fromEntries(
        Object.entries(parsed).filter(([cookieName]) =>
          isDurableCookieName(cookieName)
        )
      );
      return storage.setItem(name, JSON.stringify(filtered));
    },
    setItemAsync: (name: string, value: string) => {
      Promise.resolve(storage.setItem(name, value));
      return Promise.resolve();
    },
  };
}

function requireVortexExpoSecureStorage(
  storage: VortexExpoSecureStorage | undefined
): VortexExpoSecureStorage {
  if (storage === undefined) {
    throw new Error(
      "Expo SecureStore storage is required on native. Pass the expo-secure-store module as storage."
    );
  }
  return storage;
}
