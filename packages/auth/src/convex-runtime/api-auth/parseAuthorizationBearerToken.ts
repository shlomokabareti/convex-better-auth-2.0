import { ApiAuthError } from "./errors";

export function parseAuthorizationBearerToken(authorizationHeader: string | null): string {
  if (authorizationHeader === null) {
    throw new ApiAuthError("AUTHORIZATION_HEADER_MISSING", "Authorization header is required.");
  }

  const trimmedHeader = authorizationHeader.trim();
  if (trimmedHeader.length === 0) {
    throw new ApiAuthError("AUTHORIZATION_HEADER_INVALID", "Authorization header cannot be empty.");
  }

  const [scheme, token, ...rest] = trimmedHeader.split(/\s+/u);
  const normalizedScheme = scheme?.toLowerCase();

  if (
    normalizedScheme !== "bearer" ||
    token === undefined ||
    rest.length > 0 ||
    token.length === 0
  ) {
    throw new ApiAuthError(
      "AUTHORIZATION_HEADER_INVALID",
      "Authorization header must be in the form 'Bearer <token>'.",
    );
  }

  return token;
}
