import { ApiAuthError, type ApiAuthErrorCode } from "./errors";

export type ApiAuthHttpErrorCode = ApiAuthErrorCode | "API_AUTH_INTERNAL_ERROR";

export type ApiAuthHttpErrorBody = {
  ok: false;
  code: ApiAuthHttpErrorCode;
  message: string;
};

export type ApiAuthHttpErrorResponseParts = {
  status: number;
  headers: Record<string, string>;
  body: ApiAuthHttpErrorBody;
};

export type ResolveApiAuthHttpErrorResponseArgs = {
  error: unknown;
  internalErrorMessage?: string;
};

export type CreateApiAuthHttpErrorResponseArgs =
  ResolveApiAuthHttpErrorResponseArgs & {
    headers?: Record<string, string>;
  };

const unauthorizedErrorCodes = new Set<ApiAuthErrorCode>([
  "AUTHORIZATION_HEADER_MISSING",
  "AUTHORIZATION_HEADER_INVALID",
  "API_CREDENTIAL_INVALID",
  "API_CREDENTIAL_UNSUPPORTED",
  "API_KEY_EXPIRED",
  "API_KEY_INVALID",
  "OAUTH_SESSION_INVALID",
  "USER_IDENTITY_NOT_LINKED",
]);

const forbiddenErrorCodes = new Set<ApiAuthErrorCode>([
  "API_KEY_IP_FORBIDDEN",
  "API_KEY_IP_MISSING",
  "PRINCIPAL_RESTRICTED",
  "ORGANIZATION_ACCESS_DENIED",
  "SCOPE_FORBIDDEN",
]);

const badRequestErrorCodes = new Set<ApiAuthErrorCode>([
  "API_CREDENTIAL_AMBIGUOUS",
  "API_KEY_HEADER_INVALID",
]);

export function resolveApiAuthHttpStatus(code: ApiAuthErrorCode): number {
  if (badRequestErrorCodes.has(code)) {
    return 400;
  }

  if (forbiddenErrorCodes.has(code)) {
    return 403;
  }

  if (unauthorizedErrorCodes.has(code)) {
    return 401;
  }

  return 500;
}

export function resolveApiAuthHttpErrorResponse(
  args: ResolveApiAuthHttpErrorResponseArgs
): ApiAuthHttpErrorResponseParts {
  if (args.error instanceof ApiAuthError) {
    const status = resolveApiAuthHttpStatus(args.error.code);
    return {
      status,
      headers: createApiAuthHttpHeaders(status),
      body: {
        ok: false,
        code: args.error.code,
        message: args.error.message,
      },
    };
  }

  return {
    status: 500,
    headers: createApiAuthHttpHeaders(500),
    body: {
      ok: false,
      code: "API_AUTH_INTERNAL_ERROR",
      message: args.internalErrorMessage ?? "Internal API auth error.",
    },
  };
}

export function createApiAuthHttpErrorResponse(
  args: CreateApiAuthHttpErrorResponseArgs
): Response {
  const parts = resolveApiAuthHttpErrorResponse(args);

  return new Response(JSON.stringify(parts.body), {
    status: parts.status,
    headers: {
      ...parts.headers,
      ...args.headers,
    },
  });
}

function createApiAuthHttpHeaders(status: number): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (status === 401) {
    headers["www-authenticate"] = "Bearer";
  }

  return headers;
}
