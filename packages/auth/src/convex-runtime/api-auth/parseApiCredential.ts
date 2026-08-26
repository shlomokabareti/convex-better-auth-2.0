import { ApiAuthError } from "./errors";
import { parseAuthorizationBearerToken } from "./parseAuthorizationBearerToken";
import type { ApiBearerCredential } from "./types";

export type ParsedApiCredentialType = ApiBearerCredential["credentialType"];

export type ParseApiCredentialArgs = {
  authorizationHeader?: string | null;
  apiKeyHeader?: string | null;
  apiKeyTokenPrefixes?: readonly string[];
};

export function parseApiCredential(
  args: ParseApiCredentialArgs
): ApiBearerCredential {
  const authorizationHeader = normalizeHeaderValue(
    args.authorizationHeader ?? null
  );
  const apiKeyHeader = normalizeHeaderValue(args.apiKeyHeader ?? null);

  if (authorizationHeader !== null && apiKeyHeader !== null) {
    throw new ApiAuthError(
      "API_CREDENTIAL_AMBIGUOUS",
      "Use either Authorization or X-API-Key, not both."
    );
  }

  if (apiKeyHeader !== null) {
    assertApiKeyTokenPrefix(apiKeyHeader, args.apiKeyTokenPrefixes ?? []);
    return {
      credentialType: "apiKeyBearer",
      token: apiKeyHeader,
    };
  }

  if (authorizationHeader === null) {
    throw new ApiAuthError(
      "AUTHORIZATION_HEADER_MISSING",
      "Authorization or X-API-Key header is required."
    );
  }

  const token = parseAuthorizationBearerToken(authorizationHeader);
  return {
    credentialType: resolveCredentialTypeFromBearerToken({
      token,
      apiKeyTokenPrefixes: args.apiKeyTokenPrefixes ?? [],
    }),
    token,
  };
}

export function resolveCredentialTypeFromBearerToken(args: {
  token: string;
  apiKeyTokenPrefixes: readonly string[];
}): ParsedApiCredentialType {
  return matchesApiKeyTokenPrefix(args.token, args.apiKeyTokenPrefixes)
    ? "apiKeyBearer"
    : "userBearer";
}

export function matchesApiKeyTokenPrefix(
  token: string,
  apiKeyTokenPrefixes: readonly string[]
): boolean {
  const prefixes = normalizeApiKeyTokenPrefixes(apiKeyTokenPrefixes);
  return prefixes.some((prefix) => token.startsWith(prefix));
}

function normalizeHeaderValue(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? null
    : normalized;
}

function assertApiKeyTokenPrefix(
  token: string,
  apiKeyTokenPrefixes: readonly string[]
): void {
  if (
    apiKeyTokenPrefixes.length === 0 ||
    matchesApiKeyTokenPrefix(token, apiKeyTokenPrefixes)
  ) {
    return;
  }

  throw new ApiAuthError(
    "API_KEY_HEADER_INVALID",
    "X-API-Key header contains an unsupported key prefix."
  );
}

function normalizeApiKeyTokenPrefixes(
  apiKeyTokenPrefixes: readonly string[]
): string[] {
  const prefixes = new Set<string>();

  for (const rawPrefix of apiKeyTokenPrefixes) {
    const prefix = rawPrefix.trim();
    if (prefix.length > 0) {
      prefixes.add(prefix);
    }
  }

  return [...prefixes];
}
