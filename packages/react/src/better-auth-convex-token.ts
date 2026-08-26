export type BetterAuthConvexTokenFetchOptions = {
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  throw?: boolean;
};

export type BetterAuthConvexTokenResponse = {
  data?: {
    token?: string | null;
  } | null;
};

export type BetterAuthConvexTokenClient = {
  convex?: {
    token(args?: {
      fetchOptions?: BetterAuthConvexTokenFetchOptions;
    }): Promise<BetterAuthConvexTokenResponse>;
  };
};

export type BetterAuthConvexTokenRequest = {
  cachedToken: string | null;
  forceRefreshToken: boolean;
};

export type BetterAuthConvexTokenSource = (
  request: BetterAuthConvexTokenRequest
) => Promise<string | null>;

export type BetterAuthConvexTokenRefreshFailure = {
  error: unknown;
  forceRefreshToken: boolean;
  hadCachedToken: boolean;
  hadFallbackToken: boolean;
};

export type BetterAuthConvexTokenCache = {
  clear(): void;
  getCachedToken(minTimeRemainingMs?: number): string | null;
  getToken(args?: { forceRefreshToken?: boolean }): Promise<string | null>;
  setToken(token: string | null): void;
};

const DEFAULT_MIN_TIME_REMAINING_MS = 60_000;

export function decodeJwtExpirationMs(token: string): number | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (payload === undefined) {
    return null;
  }

  try {
    const normalizedPayload = payload.replaceAll("-", "+").replaceAll("_", "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decodedPayload = decodeBase64(paddedPayload);
    const parsedPayload: unknown = JSON.parse(decodedPayload);
    if (typeof parsedPayload !== "object" || parsedPayload === null) {
      return null;
    }
    const expiration = Reflect.get(parsedPayload, "exp");
    return typeof expiration === "number" ? expiration * 1000 : null;
  } catch {
    return null;
  }
}

export function createBetterAuthConvexTokenCache(args: {
  fetchFreshToken: BetterAuthConvexTokenSource;
  initialToken?: string | null;
  minimumTimeRemainingMs?: number;
  now?: () => number;
  onTokenChange?: (token: string | null, expiresAt: number | null) => void;
  onTokenRefreshFailure?: (
    failure: BetterAuthConvexTokenRefreshFailure
  ) => void;
}): BetterAuthConvexTokenCache {
  const minimumTimeRemainingMs =
    args.minimumTimeRemainingMs ?? DEFAULT_MIN_TIME_REMAINING_MS;
  const now = args.now ?? Date.now;
  let cachedToken: string | null = null;
  let cachedExpiresAt: number | null = null;
  let pendingToken: Promise<string | null> | null = null;

  const setToken = (token: string | null) => {
    cachedToken = token;
    cachedExpiresAt = token === null ? null : decodeJwtExpirationMs(token);
    args.onTokenChange?.(cachedToken, cachedExpiresAt);
  };
  setToken(args.initialToken ?? null);
  const getCachedToken = (minTimeRemainingMs = minimumTimeRemainingMs) => {
    if (cachedToken === null || cachedExpiresAt === null) {
      return null;
    }
    return cachedExpiresAt > now() + minTimeRemainingMs ? cachedToken : null;
  };
  const fetchFreshToken = (forceRefreshToken: boolean) => {
    if (pendingToken !== null) {
      return pendingToken;
    }

    const hadCachedToken = cachedToken !== null;
    pendingToken = args
      .fetchFreshToken({ cachedToken, forceRefreshToken })
      .then((token) => {
        if (token !== null) {
          setToken(token);
          return token;
        }

        const fallbackToken = getCachedToken(0);
        if (fallbackToken !== null) {
          args.onTokenRefreshFailure?.({
            error: new Error("Better Auth token refresh returned no token."),
            forceRefreshToken,
            hadCachedToken,
            hadFallbackToken: true,
          });
          return fallbackToken;
        }
        args.onTokenRefreshFailure?.({
          error: new Error("Better Auth token refresh returned no token."),
          forceRefreshToken,
          hadCachedToken,
          hadFallbackToken: false,
        });
        setToken(null);
        return null;
      })
      .catch((error: unknown) => {
        const fallbackToken = getCachedToken(0);
        const hadFallbackToken = fallbackToken !== null;
        args.onTokenRefreshFailure?.({
          error,
          forceRefreshToken,
          hadCachedToken,
          hadFallbackToken,
        });
        if (fallbackToken !== null) {
          return fallbackToken;
        }

        setToken(null);
        return null;
      })
      .finally(() => {
        pendingToken = null;
      });

    return pendingToken;
  };
  return {
    clear: () => setToken(null),
    getCachedToken,
    getToken: async ({ forceRefreshToken = false } = {}) => {
      if (!forceRefreshToken) {
        const cachedUsableToken = getCachedToken();
        if (cachedUsableToken !== null) {
          return cachedUsableToken;
        }
        return await fetchFreshToken(false);
      }
      if (pendingToken !== null) {
        const tokenFromPendingRequest = await pendingToken;
        const cachedUsableToken = getCachedToken();
        if (
          tokenFromPendingRequest !== null &&
          tokenFromPendingRequest !== cachedUsableToken
        ) {
          return tokenFromPendingRequest;
        }
      }

      return await fetchFreshToken(true);
    },
    setToken,
  };
}

export async function fetchBetterAuthConvexBearerToken(args: {
  authClient?: BetterAuthConvexTokenClient | null;
  betterAuthBaseUrl?: string | null;
  cachedToken?: string | null;
  fetchImpl?: typeof fetch;
  forceRefreshToken?: boolean;
}): Promise<string | null> {
  const pluginToken = await args.authClient?.convex?.token({
    fetchOptions: buildBetterAuthConvexTokenFetchOptions(
      args.cachedToken ?? null
    ),
  });
  if (typeof pluginToken?.data?.token === "string") {
    return pluginToken.data.token;
  }

  const baseUrl = args.betterAuthBaseUrl?.trim();
  if (!baseUrl) {
    return null;
  }

  const fetchImpl = args.fetchImpl ?? fetch;
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const response = await fetchImpl(`${normalizedBase}/convex/token`, {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const token = Reflect.get(payload, "token");
  return typeof token === "string" ? token : null;
}

function buildBetterAuthConvexTokenFetchOptions(
  cachedToken: string | null
): BetterAuthConvexTokenFetchOptions {
  const fetchOptions: BetterAuthConvexTokenFetchOptions = {
    throw: false,
  };

  if (cachedToken !== null && decodeJwtExpirationMs(cachedToken) === null) {
    fetchOptions.credentials = "omit";
    fetchOptions.headers = {
      Authorization: `Bearer ${cachedToken}`,
    };
  }

  return fetchOptions;
}

function decodeBase64(input: string) {
  const decode = globalThis.atob;
  if (typeof decode === "function") {
    return decode(input);
  }

  throw new Error("Base64 decoding is not available in this runtime.");
}
