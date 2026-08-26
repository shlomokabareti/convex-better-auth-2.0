export type ApiAuthErrorCode =
  | "AUTHORIZATION_HEADER_MISSING"
  | "AUTHORIZATION_HEADER_INVALID"
  | "API_KEY_HEADER_INVALID"
  | "API_CREDENTIAL_AMBIGUOUS"
  | "API_CREDENTIAL_INVALID"
  | "API_CREDENTIAL_UNSUPPORTED"
  | "API_KEY_EXPIRED"
  | "API_KEY_IP_FORBIDDEN"
  | "API_KEY_IP_MISSING"
  | "API_KEY_INVALID"
  | "OAUTH_SESSION_INVALID"
  | "USER_IDENTITY_NOT_LINKED"
  | "PRINCIPAL_RESTRICTED"
  | "ORGANIZATION_ACCESS_DENIED"
  | "SCOPE_FORBIDDEN";

export class ApiAuthError extends Error {
  readonly code: ApiAuthErrorCode;

  constructor(
    code: ApiAuthErrorCode,
    message: string,
    options: ErrorOptions = {}
  ) {
    super(message, options);
    this.name = "ApiAuthError";
    this.code = code;
  }
}
