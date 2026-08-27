import { expoClient } from "@better-auth/expo/client";
import { convexClient, crossDomainClient } from "convex-better-auth-adapter/client/plugins";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

import { resolveExpoAuthClientMode, type ExpoPlatformOS } from "./config";

export type ExpoBetterAuthClientFactoryOptions = NonNullable<
  Parameters<typeof createAuthClient>[0]
>;

type ExpoRuntimePlugin<PlatformOS extends ExpoPlatformOS | undefined> = PlatformOS extends "web"
  ? ReturnType<typeof crossDomainClient>
  : ReturnType<typeof expoClient>;

type ExpoBuiltInPlugin<PlatformOS extends ExpoPlatformOS | undefined> =
  | ExpoRuntimePlugin<PlatformOS>
  | ReturnType<typeof convexClient>
  | ReturnType<typeof twoFactorClient>;

type ExpoConcreteCustomPlugin<Plugins extends readonly BetterAuthClientPlugin[]> =
  BetterAuthClientPlugin extends Plugins[number] ? never : Plugins[number];

type ExpoBetterAuthClientConfig<
  PlatformOS extends ExpoPlatformOS | undefined,
  Plugins extends readonly BetterAuthClientPlugin[],
> = Omit<ExpoBetterAuthClientFactoryOptions, "plugins"> & {
  plugins: Array<ExpoBuiltInPlugin<PlatformOS> | ExpoConcreteCustomPlugin<Plugins>>;
};

export type ExpoBetterAuthClient<
  PlatformOS extends ExpoPlatformOS | undefined = ExpoPlatformOS | undefined,
  Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
> = PlatformOS extends ExpoPlatformOS | undefined
  ? ReactAuthClient<ExpoBetterAuthClientConfig<PlatformOS, Plugins>>
  : never;

export type ExpoSecureStorage = Parameters<typeof expoClient>[0]["storage"];
export type ExpoCookiePrefix = Parameters<typeof expoClient>[0]["cookiePrefix"];
export type ExpoWebBrowserOptions = Parameters<typeof expoClient>[0]["webBrowserOptions"];

export type ExpoBetterAuthClientOptions<
  Plugins extends readonly BetterAuthClientPlugin[] = readonly BetterAuthClientPlugin[],
> = Omit<ExpoBetterAuthClientFactoryOptions, "plugins"> & {
  cookiePrefix?: ExpoCookiePrefix;
  disableCache?: boolean;
  platformOS?: ExpoPlatformOS;
  plugins?: Plugins;
  scheme: string;
  storage?: ExpoSecureStorage;
  storagePrefix?: string;
  webBrowserOptions?: ExpoWebBrowserOptions;
};

export function createExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: ExpoBetterAuthClientOptions<Plugins> & { platformOS: "web" },
): ExpoBetterAuthClient<"web", Plugins>;
export function createExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: ExpoBetterAuthClientOptions<Plugins> & {
    platformOS?: Exclude<ExpoPlatformOS, "web">;
  },
): ExpoBetterAuthClient<undefined, Plugins>;
export function createExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(
  options: ExpoBetterAuthClientOptions<Plugins>,
): ExpoBetterAuthClient<ExpoPlatformOS | undefined, Plugins>;
export function createExpoBetterAuthClient<
  const Plugins extends readonly BetterAuthClientPlugin[] = readonly [],
>(options: ExpoBetterAuthClientOptions<Plugins>) {
  const { pluginOptions, clientOptions } = splitExpoBetterAuthClientOptions(options);
  const mode = resolveExpoAuthClientMode(pluginOptions);
  const suppliedPlugins = options.plugins ?? [];

  if (mode.kind === "web") {
    const plugins = addExpoBuiltInPlugins(suppliedPlugins, crossDomainClient());
    return createAuthClient({
      ...clientOptions,
      plugins,
    });
  }

  const plugins = addExpoBuiltInPlugins(
    suppliedPlugins,
    expoClient({
      cookiePrefix: pluginOptions.cookiePrefix,
      disableCache: pluginOptions.disableCache,
      scheme: mode.scheme,
      storage: createDurableCookieFilteredStorage(requireExpoSecureStorage(pluginOptions.storage)),
      storagePrefix: mode.storagePrefix,
      webBrowserOptions: pluginOptions.webBrowserOptions,
    }),
  );
  return createAuthClient({
    ...clientOptions,
    plugins,
  });
}

function addExpoBuiltInPlugins<
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

function splitExpoBetterAuthClientOptions(options: ExpoBetterAuthClientOptions) {
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

function createDurableCookieFilteredStorage(storage: ExpoSecureStorage): ExpoSecureStorage {
  const filterValue = (name: string, value: string): string => {
    // Only the bundled cookie key (`<prefix>_cookie`) is filtered.
    // The separate `<prefix>_session_data` body cache passes through.
    if (!name.endsWith("_cookie")) {
      return value;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      // Unparseable — pass through rather than silently dropping it.
      return value;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return value;
    }
    const filtered = Object.fromEntries(
      Object.entries(parsed).filter(([cookieName]) => isDurableCookieName(cookieName)),
    );
    return JSON.stringify(filtered);
  };

  return {
    getItem: (name: string) => storage.getItem(name),
    getItemAsync: (name: string) =>
      typeof storage.getItemAsync === "function"
        ? storage.getItemAsync(name)
        : Promise.resolve(storage.getItem(name)),
    setItem: (name: string, value: string) => storage.setItem(name, filterValue(name, value)),
    setItemAsync: async (name: string, value: string) => {
      const filtered = filterValue(name, value);
      if (typeof storage.setItemAsync === "function") {
        await storage.setItemAsync(name, filtered);
      } else {
        storage.setItem(name, filtered);
      }
    },
  };
}

function requireExpoSecureStorage(storage: ExpoSecureStorage | undefined): ExpoSecureStorage {
  if (storage === undefined) {
    throw new Error(
      "Expo SecureStore storage is required on native. Pass the expo-secure-store module as storage.",
    );
  }
  return storage;
}
