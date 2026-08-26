export type McpOAuthTokenEndpointAuthMethod =
  | "none"
  | "client_secret_post"
  | "client_secret_basic"
  /**
   * RFC 7523 client assertion. The credential format the MCP
   * `oauth-client-credentials` extension recommends over client secrets: the
   * client signs with a key the server never holds, and each assertion is
   * short-lived rather than a standing secret.
   */
  | "private_key_jwt";

/** A public key a machine client registered for `private_key_jwt`. */
export type McpOAuthClientAssertionKey = {
  keyId: string;
  /** Public JWK. The private half never leaves the client. */
  publicJwk: Record<string, unknown>;
  /** Pinned at verification time; the assertion header's `alg` is not trusted. */
  algorithm: string;
};

export type McpOAuthClientIdMetadataValidateArgs = {
  /** The `client_id` presented by the client — an HTTPS metadata document URL. */
  clientIdUrl: string;
  /** The parsed JSON body fetched from that URL. */
  document: unknown;
};

export type McpOAuthClientIdMetadataResult =
  | {
      ok: true;
      clientId: string;
      clientName: string;
      clientUri: string | null;
      redirectUris: readonly string[];
      scope: string | null;
      /**
       * The document claims a `client_uri` on a different origin than the one
       * serving it. Not fatal, but a consent screen must be able to warn: it is
       * how a client impersonates a more trusted brand.
       */
      clientUriOriginMismatch: boolean;
    }
  | {
      ok: false;
      error: "invalid_client" | "invalid_client_metadata";
      errorDescription: string;
    };

/** Tenant and audience a machine client acts for. */
export type McpOAuthClientCredentialsTarget = {
  ok: true;
  organizationId: string;
  audience: string;
};

export type McpOAuthClientAssertionVerifyArgs = {
  assertion: string;
  assertionType: string;
  clientId: string;
  clientKeys: readonly McpOAuthClientAssertionKey[];
  /** Expected `aud`: this authorization server's token endpoint URL. */
  tokenEndpoint: string;
  /** Injectable clock (epoch millis); defaults to now. */
  now?: number;
};

export type McpOAuthClientAssertionResult =
  | {
      ok: true;
      clientId: string;
      keyId: string;
      /** `jti`, when present — the caller may use it to reject replays. */
      assertionId: string | null;
      expiresAt: number;
    }
  | {
      ok: false;
      error: "invalid_client";
      errorDescription: string;
    };

export type McpOAuthProtocolConfig = {
  resourceSlug: string;
  resourceId: string;
  audience: string;
  scopesSupported: readonly string[];
  mcpPath?: string;
  oauthBasePath?: string;
  issuerPath?: string;
  responseTypesSupported?: readonly string[];
  grantTypesSupported?: readonly string[];
  tokenEndpointAuthMethodsSupported?: readonly McpOAuthTokenEndpointAuthMethod[];
  codeChallengeMethodsSupported?: readonly string[];
  bearerMethodsSupported?: readonly string[];
  /**
   * Advertise CIMD. Off by default: a deployment must first be able to fetch
   * client metadata safely (egress policy, SSRF guards, cache) before telling
   * clients a URL client_id will work here.
   */
  clientIdMetadataDocumentSupported?: boolean;
};

export type OAuthAuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  jwks_uri: string;
  response_types_supported: readonly string[];
  grant_types_supported: readonly string[];
  token_endpoint_auth_methods_supported: readonly string[];
  code_challenge_methods_supported: readonly string[];
  scopes_supported: readonly string[];
  resource: string;
  /** draft-ietf-oauth-client-id-metadata-document: URL client_ids accepted. */
  client_id_metadata_document_supported?: boolean;
};

export type OAuthProtectedResourceMetadata = {
  resource: string;
  authorization_servers: readonly string[];
  jwks_uri: string;
  bearer_methods_supported: readonly string[];
  scopes_supported: readonly string[];
};

export type PkcePair = {
  verifier: string;
  challenge: string;
  method: "S256";
};

export type McpOAuthClient = {
  clientId: string;
  name: string;
  redirectUris: readonly string[];
  allowedScopes: readonly string[];
  tokenEndpointAuthMethod?: McpOAuthTokenEndpointAuthMethod;
  pkceRequired?: boolean;
  grantTypes?: readonly string[];
  responseTypes?: readonly string[];
  softwareId?: string | null;
  softwareVersion?: string | null;
};

export type McpOAuthDynamicClientRegistrationInput = {
  clientName: string;
  redirectUris: readonly string[];
  scope?: string | null;
  tokenEndpointAuthMethod?: McpOAuthTokenEndpointAuthMethod | null;
  grantTypes?: readonly string[] | null;
  responseTypes?: readonly string[] | null;
  softwareId?: string | null;
  softwareVersion?: string | null;
};

export type McpOAuthDynamicClientRegistrationPolicy = {
  supportedScopes: readonly string[];
  allowedAuthMethods?: readonly McpOAuthTokenEndpointAuthMethod[];
  allowedGrantTypes?: readonly string[];
  allowedResponseTypes?: readonly string[];
  allowLocalhostHttp?: boolean;
  requirePkce?: boolean;
};

export type McpOAuthDynamicClientRegistrationResult = McpOAuthClient & {
  registrationClientUri?: string | null;
  registrationAccessToken?: string | null;
};

export type McpOAuthDynamicClientRegistrationError = {
  error: "invalid_client_metadata";
  error_description: string;
};

export type McpOAuthDynamicClientRegistrationValidation = {
  parsed: McpOAuthDynamicClientRegistrationInput;
  validationError: McpOAuthDynamicClientRegistrationError | null;
};

export type McpOAuthDynamicClientRegistrationResponse = {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: readonly string[];
  grant_types?: readonly string[];
  response_types?: readonly string[];
  token_endpoint_auth_method?: string;
  scope: string;
  software_id?: string | null;
  software_version?: string | null;
};

export type McpOAuthStoredClientRecord = {
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  tokenEndpointAuthMethod: McpOAuthTokenEndpointAuthMethod;
  pkceRequired: boolean;
  grantTypes: string[];
  responseTypes: string[];
  softwareId?: string | undefined;
  softwareVersion?: string | undefined;
  createdAt: number;
  updatedAt: number;
};

export type McpOAuthAuthorizeRequestConfig = {
  defaultAudience: string;
  defaultResourceId: string;
  expectedAudience?: string;
  expectedResourceId?: string;
  allowTestingExpiresInMs?: boolean;
};

export type McpOAuthAuthorizeRequest = {
  audience: string;
  clientId: string;
  codeChallenge: string;
  expiresInMs?: number;
  organizationId: string | null;
  redirectUri: string;
  resourceId: string;
  scope: string;
  state?: string;
};

export type McpOAuthAuthorizationCodeRecord = {
  clientId: string;
  betterAuthUserId: string;
  organizationId: string;
  scopes: readonly string[];
  codeChallenge: string;
  codeChallengeMethod: "S256";
  audience: string;
  resourceId: string;
  /**
   * Absolute expiry (epoch millis) stamped at issuance
   * (`createAuthorizationCode`). The token-exchange validator REJECTS the code
   * once `now >= expiresAt`, so the consumer MUST persist this at issuance and
   * return it here — the package owns the expiry it issues rather than trusting
   * every consumer's `consumeAuthorizationCode` to enforce it.
   */
  expiresAt: number;
};

export type McpOAuthAuthorizationCodeTokenRequest = {
  grantType: string | null;
  code: string | null;
  clientId: string | null;
  redirectUri: string | null;
  codeVerifier: string | null;
  clientSecret: string | null;
  authorizationHeader: string | null;
};

export type McpOAuthAuthorizationCodeTokenExchangeFailure = {
  ok: false;
  status: number;
  body: {
    error: string;
    error_description?: string;
  };
};

export type McpOAuthAuthorizationCodeTokenExchangeSuccess<
  TClient extends McpOAuthClient,
  TAuthorizationCode extends McpOAuthAuthorizationCodeRecord,
> = {
  ok: true;
  client: TClient;
  authorizationCode: TAuthorizationCode;
};

/**
 * Result of a `client_credentials` token request — the MCP
 * `io.modelcontextprotocol/oauth-client-credentials` extension.
 *
 * There is no authorization code and no user: the granted scopes are derived
 * from the request intersected with the client's registered ceiling, so a
 * machine client can never widen its own access.
 */
export type McpOAuthClientCredentialsTokenExchangeSuccess<TClient extends McpOAuthClient> = {
  ok: true;
  client: TClient;
  scopes: readonly string[];
};

export type McpOAuthClientCredentialsTokenExchangeFailure =
  McpOAuthAuthorizationCodeTokenExchangeFailure;

export type McpOAuthSigningAlgorithm = "ES256";

export type McpOAuthSigningKeyRecord = {
  keyId: string;
  algorithm: McpOAuthSigningAlgorithm;
  publicJwkJson: string;
  privateJwkJson: string;
};

export type McpOAuthSigningKeyPublicationRecord = {
  retiredAt: number | null;
  status: "active" | "retired";
};

export type McpOAuthJwks = {
  keys: Record<string, unknown>[];
};

export type McpOAuthAccessTokenClaims = {
  clientId: string;
  /**
   * Omitted for machine tokens (`client_credentials`), which have no user.
   * Absent rather than blank on purpose: anything that authorises by user id
   * then fails to find one, instead of treating a machine as a person.
   */
  betterAuthUserId?: string;
  resourceId: string;
  scopes: readonly string[];
  organizationId?: string;
  organizationSlug?: string;
  subjectType?: string;
  extraClaims?: Record<string, unknown>;
};

export type McpOAuthSignedAccessToken = {
  accessToken: string;
  expiresIn: number;
  scope: string;
  tokenType: "Bearer";
};

export type McpOAuthAccessTokenVerificationResult = {
  keyId: string;
  audience: string[];
  issuer: string | null;
  subject: string | null;
  clientId: string | null;
  betterAuthUserId: string | null;
  organizationId: string | null;
  organizationSlug: string | null;
  resourceId: string | null;
  scope: string;
  subjectType: string | null;
  issuedAt: number | null;
  expiresAt: number | null;
  claims: Record<string, unknown>;
};

export type McpOAuthRefreshTokenPolicy = {
  absoluteLifetimeMs: number;
  inactivityLifetimeMs: number | null;
};

export type McpOAuthRefreshTokenHashResult = {
  tokenHash: string;
};

export type McpOAuthRefreshTokenGrantRequest = {
  grantType: string | null;
  refreshToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
  scope: string | null;
  authorizationHeader: string | null;
};

export type McpOAuthRefreshTokenRecord = {
  tokenId: string;
  familyId: string;
  parentTokenId?: string | null;
  clientId: string;
  betterAuthUserId: string;
  organizationId: string;
  scopes: readonly string[];
  audience: string;
  resourceId: string;
  issuedAt: number;
  expiresAt: number;
  inactivityExpiresAt?: number | null;
  consumedAt?: number | null;
  revokedAt?: number | null;
  replacedByTokenId?: string | null;
};

export type McpOAuthRefreshTokenIssueArgs = {
  clientId: string;
  betterAuthUserId: string;
  organizationId: string;
  scopes: readonly string[];
  audience: string;
  resourceId: string;
  policy: McpOAuthRefreshTokenPolicy;
  now?: number;
  refreshToken?: string;
  tokenId?: string;
  familyId?: string;
  parentTokenId?: string | null;
};

export type McpOAuthRefreshTokenIssueResult = {
  refreshToken: string;
  record: McpOAuthRefreshTokenRecord;
};

export type McpOAuthRefreshTokenRotateArgs = {
  record: McpOAuthRefreshTokenRecord;
  policy: McpOAuthRefreshTokenPolicy;
  now?: number;
  refreshToken?: string;
  tokenId?: string;
  scopes?: readonly string[];
};

export type McpOAuthRefreshTokenRotateResult = {
  refreshToken: string;
  record: McpOAuthRefreshTokenRecord;
  consumedRecordPatch: {
    consumedAt: number;
    replacedByTokenId: string;
  };
};

export type McpOAuthRefreshTokenStatus = "active" | "expired" | "inactive" | "consumed" | "revoked";

export type McpOAuthRefreshTokenFamilyRevocationReason = "replay_detected" | "concurrent_conflict";

export type McpOAuthRefreshTokenFamilyRevocationRequest = {
  familyId: string;
  revokedAt: number;
  reason: McpOAuthRefreshTokenFamilyRevocationReason;
};

export type McpOAuthRefreshTokenAtomicRotateInput<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
> = {
  currentRecord: TRecord;
  currentRefreshToken: string;
  nextRecord: McpOAuthRefreshTokenRecord;
  nextRefreshToken: string;
  consumedRecordPatch: {
    consumedAt: number;
    replacedByTokenId: string;
  };
};

export type McpOAuthRefreshTokenAtomicRotateResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "not_found" };

export type McpOAuthRefreshTokenStorageAdapter<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
> = {
  findForRefreshToken: (input: {
    refreshToken: string;
    clientId: string;
  }) => Promise<TRecord | null> | TRecord | null;
  rotate: (
    input: McpOAuthRefreshTokenAtomicRotateInput<TRecord>,
  ) => Promise<McpOAuthRefreshTokenAtomicRotateResult> | McpOAuthRefreshTokenAtomicRotateResult;
  revokeFamily?: (input: McpOAuthRefreshTokenFamilyRevocationRequest) => Promise<void> | void;
};

export type McpOAuthRefreshTokenGrantFailure = {
  ok: false;
  status: number;
  body: {
    error: string;
    error_description?: string;
  };
};

export type McpOAuthRefreshTokenGrantSuccess<TClient extends McpOAuthClient> = {
  ok: true;
  client: TClient;
  refreshToken: string;
  requestedScopes: readonly string[];
};

export type McpOAuthRefreshTokenResolveScopesFailure = {
  ok: false;
  error: "invalid_scope";
  error_description: string;
};

export type McpOAuthRefreshTokenResolveScopesSuccess = {
  ok: true;
  scopes: readonly string[];
};

export type McpOAuthRefreshTokenRedeemFailureReason =
  | "not_found"
  | "expired"
  | "inactive"
  | "revoked"
  | "replay_detected"
  | "concurrent_conflict"
  | "invalid_scope";

export type McpOAuthRefreshTokenRedeemFailure = {
  ok: false;
  status: number;
  body: {
    error: "invalid_grant" | "invalid_scope";
    error_description?: string;
  };
  reason: McpOAuthRefreshTokenRedeemFailureReason;
  familyRevocation?: McpOAuthRefreshTokenFamilyRevocationRequest;
};

export type McpOAuthRefreshTokenRedeemSuccess<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
> = {
  ok: true;
  record: TRecord;
  scopes: readonly string[];
  rotation: McpOAuthRefreshTokenRotateResult;
};

export type McpOAuthRefreshTokenRedeemResult<
  TRecord extends McpOAuthRefreshTokenRecord = McpOAuthRefreshTokenRecord,
> = McpOAuthRefreshTokenRedeemFailure | McpOAuthRefreshTokenRedeemSuccess<TRecord>;

export type McpOAuthTokenEndpointClientAuthArgs = {
  authorizationHeader: string | null;
  clientSecret: string | { name?: string | null } | null;
  /** RFC 7523 `client_assertion`, when the client authenticates by signed JWT. */
  clientAssertion?: string | null;
  supportedMethods?: readonly McpOAuthTokenEndpointAuthMethod[];
};

export type McpOAuthTokenEndpointClientAuthError = {
  error: "invalid_client";
  error_description: string;
};
