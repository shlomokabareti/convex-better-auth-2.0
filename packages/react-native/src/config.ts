export type VortexExpoPlatformOS =
  | "android"
  | "ios"
  | "web"
  | "macos"
  | "windows"
  | "native";

export type VortexExpoResolvedAuthConfig = {
  convexSiteUrl: string;
  convexUrl: string;
  platformOS: VortexExpoPlatformOS;
  scheme: string;
};

export type VortexExpoAuthClientMode =
  | {
      kind: "native";
      scheme: string;
      storagePrefix: string;
    }
  | {
      kind: "web";
      scheme: string;
      storagePrefix: string;
    };

export function resolveVortexExpoAuthConfig(args: {
  convexSiteUrl?: string | null;
  convexUrl?: string | null;
  platformOS: VortexExpoPlatformOS;
  scheme?: string | readonly string[] | null;
}): VortexExpoResolvedAuthConfig {
  const convexUrl = requireVortexExpoNonEmpty(
    "EXPO_PUBLIC_CONVEX_URL",
    args.convexUrl
  );

  return {
    convexSiteUrl:
      normalizeOptionalVortexExpoString(args.convexSiteUrl) ??
      deriveVortexExpoConvexSiteUrl(convexUrl),
    convexUrl,
    platformOS: args.platformOS,
    scheme: resolveVortexExpoScheme(args.scheme),
  };
}

export function deriveVortexExpoConvexSiteUrl(convexUrl: string): string {
  const normalized = requireVortexExpoNonEmpty(
    "EXPO_PUBLIC_CONVEX_URL",
    convexUrl
  );
  if (normalized.endsWith(".convex.cloud")) {
    return normalized.replace(".convex.cloud", ".convex.site");
  }
  return normalized;
}

export function resolveVortexExpoScheme(
  scheme: string | readonly string[] | null | undefined
): string {
  const resolved = Array.isArray(scheme) ? scheme[0] : scheme;
  return normalizeVortexExpoScheme(
    requireVortexExpoNonEmpty("Expo scheme", resolved)
  );
}

export function resolveVortexExpoAuthClientMode(args: {
  platformOS?: VortexExpoPlatformOS;
  scheme: string;
  storagePrefix?: string;
}): VortexExpoAuthClientMode {
  const scheme = normalizeVortexExpoScheme(args.scheme);
  const storagePrefix = normalizeVortexExpoStoragePrefix(
    args.storagePrefix ?? scheme
  );

  return {
    kind: args.platformOS === "web" ? "web" : "native",
    scheme,
    storagePrefix,
  };
}

export function normalizeVortexExpoTrustedOrigin(scheme: string): string {
  return `${normalizeVortexExpoScheme(scheme)}://`;
}

export function buildVortexExpoTrustedOrigins(args: {
  includeExpoDevelopmentOrigins?: boolean;
  scheme: string;
  siteUrl?: string | null;
}): string[] {
  const origins = [normalizeVortexExpoTrustedOrigin(args.scheme)];
  const siteUrl = args.siteUrl?.trim();
  if (siteUrl) {
    origins.push(siteUrl);
  }

  if (args.includeExpoDevelopmentOrigins === true) {
    origins.push("exp://", "exp://**", "exp://192.168.*.*:*/**");
  }

  return Array.from(new Set(origins));
}

function normalizeVortexExpoScheme(scheme: string): string {
  const normalized = scheme.trim().replace(/:\/\/.*$/, "");
  if (!normalized) {
    throw new Error("Expo auth scheme is required.");
  }
  if (!/^[a-z][a-z0-9+.-]*$/i.test(normalized)) {
    throw new Error(`Invalid Expo auth scheme: ${scheme}`);
  }
  return normalized;
}

function normalizeVortexExpoStoragePrefix(storagePrefix: string): string {
  const normalized = storagePrefix.trim();
  if (!normalized) {
    throw new Error("Expo auth storagePrefix is required.");
  }
  return normalized;
}

function normalizeOptionalVortexExpoString(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function requireVortexExpoNonEmpty(
  label: string,
  value: string | null | undefined
): string {
  const normalized = normalizeOptionalVortexExpoString(value);
  if (normalized === undefined) {
    throw new Error(`${label} is required for Vortex Auth Expo setup.`);
  }
  return normalized;
}
