import type {
  McpOAuthClient,
  McpOAuthDynamicClientRegistrationError,
  McpOAuthDynamicClientRegistrationInput,
  McpOAuthDynamicClientRegistrationPolicy,
  McpOAuthDynamicClientRegistrationResult,
  McpOAuthTokenEndpointAuthMethod,
} from "./types";

const DEFAULT_ALLOWED_AUTH_METHODS = ["none"] as const;
const DEFAULT_ALLOWED_GRANT_TYPES = ["authorization_code", "refresh_token"] as const;
const DEFAULT_ALLOWED_RESPONSE_TYPES = ["code"] as const;

export function registerMcpOAuthClient(
  input: McpOAuthDynamicClientRegistrationInput,
  policy: McpOAuthDynamicClientRegistrationPolicy,
  options?: {
    clientId?: string;
    generateClientId?: () => string;
  },
): McpOAuthDynamicClientRegistrationResult {
  const normalized = normalizeMcpOAuthDynamicClientRegistrationInput(input, policy);
  const clientId =
    options?.clientId?.trim() || options?.generateClientId?.() || `mcp_${crypto.randomUUID()}`;

  return {
    clientId,
    name: normalized.name,
    redirectUris: normalized.redirectUris,
    allowedScopes: normalized.allowedScopes,
    tokenEndpointAuthMethod: normalized.tokenEndpointAuthMethod,
    pkceRequired: normalized.pkceRequired,
    grantTypes: normalized.grantTypes,
    responseTypes: normalized.responseTypes,
    softwareId: normalized.softwareId,
    softwareVersion: normalized.softwareVersion,
    registrationClientUri: null,
    registrationAccessToken: null,
  };
}

export function normalizeMcpOAuthDynamicClientRegistrationInput(
  input: McpOAuthDynamicClientRegistrationInput,
  policy: McpOAuthDynamicClientRegistrationPolicy,
): Omit<McpOAuthClient, "clientId"> {
  const clientName = input.clientName.trim();
  if (clientName.length === 0) {
    throw invalidClientMetadata("client_name is required");
  }

  const redirectUris = normalizeRedirectUris(input.redirectUris, policy.allowLocalhostHttp ?? true);
  if (redirectUris.length === 0) {
    throw invalidClientMetadata("At least one redirect URI is required");
  }

  const tokenEndpointAuthMethod = normalizeAuthMethod(input.tokenEndpointAuthMethod, policy);
  const grantTypes = normalizeSet(
    input.grantTypes ?? DEFAULT_ALLOWED_GRANT_TYPES,
    policy.allowedGrantTypes ?? DEFAULT_ALLOWED_GRANT_TYPES,
    "grant_types",
  );
  const responseTypes = normalizeSet(
    input.responseTypes ?? DEFAULT_ALLOWED_RESPONSE_TYPES,
    policy.allowedResponseTypes ?? DEFAULT_ALLOWED_RESPONSE_TYPES,
    "response_types",
  );
  const allowedScopes = normalizeScopes(input.scope, policy.supportedScopes);

  return {
    name: clientName,
    redirectUris,
    allowedScopes,
    tokenEndpointAuthMethod,
    pkceRequired: policy.requirePkce ?? true,
    grantTypes,
    responseTypes,
    softwareId: normalizeOptionalString(input.softwareId),
    softwareVersion: normalizeOptionalString(input.softwareVersion),
  };
}

export function validateMcpOAuthDynamicClientRegistrationInput(
  input: McpOAuthDynamicClientRegistrationInput,
  policy: McpOAuthDynamicClientRegistrationPolicy,
): McpOAuthDynamicClientRegistrationError | null {
  try {
    normalizeMcpOAuthDynamicClientRegistrationInput(input, policy);
    return null;
  } catch (error) {
    if (isDynamicClientRegistrationError(error)) {
      return error;
    }

    throw error;
  }
}

function normalizeRedirectUris(
  redirectUris: readonly string[],
  allowLocalhostHttp: boolean,
): string[] {
  const normalized = Array.from(
    new Set(redirectUris.map((uri) => uri.trim()).filter((uri) => uri.length > 0)),
  );

  for (const redirectUri of normalized) {
    let parsed: URL;
    try {
      parsed = new URL(redirectUri);
    } catch {
      throw invalidClientMetadata(`Invalid redirect URI: ${redirectUri}`);
    }

    const isHttps = parsed.protocol === "https:";
    const isAllowedLocalhostHttp =
      allowLocalhostHttp &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");

    if (!isHttps && !isAllowedLocalhostHttp) {
      throw invalidClientMetadata(`Redirect URI must use https or localhost http: ${redirectUri}`);
    }
  }

  return normalized;
}

function normalizeAuthMethod(
  authMethod: McpOAuthTokenEndpointAuthMethod | null | undefined,
  policy: McpOAuthDynamicClientRegistrationPolicy,
): McpOAuthTokenEndpointAuthMethod {
  const allowedMethods = policy.allowedAuthMethods ?? DEFAULT_ALLOWED_AUTH_METHODS;
  const normalized = authMethod ?? allowedMethods[0] ?? "none";

  if (!allowedMethods.includes(normalized)) {
    throw invalidClientMetadata(`Unsupported token_endpoint_auth_method: ${normalized}`);
  }

  return normalized;
}

function normalizeSet(
  requestedValues: readonly string[],
  allowedValues: readonly string[],
  fieldName: "grant_types" | "response_types",
): string[] {
  const normalized = Array.from(
    new Set(requestedValues.map((value) => value.trim()).filter((value) => value.length > 0)),
  );

  if (normalized.length === 0) {
    throw invalidClientMetadata(`${fieldName} must include at least one supported value`);
  }

  const invalidValue = normalized.find((value) => !allowedValues.includes(value));
  if (invalidValue !== undefined) {
    throw invalidClientMetadata(`Unsupported ${fieldName} value: ${invalidValue}`);
  }

  return normalized;
}

function normalizeScopes(
  scope: string | null | undefined,
  supportedScopes: readonly string[],
): string[] {
  const requestedScopes = Array.from(
    new Set(
      (scope ?? "")
        .split(/\s+/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (requestedScopes.length === 0) {
    return [];
  }

  const invalidScope = requestedScopes.find((value) => !supportedScopes.includes(value));
  if (invalidScope !== undefined) {
    throw invalidClientMetadata(`Unsupported scope: ${invalidScope}`);
  }

  return requestedScopes;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function invalidClientMetadata(errorDescription: string): McpOAuthDynamicClientRegistrationError {
  return {
    error: "invalid_client_metadata",
    error_description: errorDescription,
  };
}

function isDynamicClientRegistrationError(
  error: unknown,
): error is McpOAuthDynamicClientRegistrationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    "error_description" in error &&
    error.error === "invalid_client_metadata"
  );
}
