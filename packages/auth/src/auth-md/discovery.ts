import {
  readHttpsUrl,
  readObject,
  readRequiredString,
  readStringArray,
} from "../agent-auth-protocol/shared";

export const AUTH_MD_DOCUMENT_PATH = "/auth.md" as const;
export const AUTH_MD_PROTECTED_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource" as const;
export const AUTH_MD_AUTHORIZATION_SERVER_METADATA_PATH =
  "/.well-known/oauth-authorization-server" as const;
export const AUTH_MD_IDENTITY_ENDPOINT_PATH = "/agent/identity" as const;
export const AUTH_MD_CLAIM_ENDPOINT_PATH = "/agent/identity/claim" as const;
export const AUTH_MD_EVENTS_ENDPOINT_PATH = "/agent/event/notify" as const;
export const AUTH_MD_TOKEN_ENDPOINT_PATH = "/oauth2/token" as const;
export const AUTH_MD_REVOCATION_ENDPOINT_PATH = "/oauth2/revoke" as const;

export const AUTH_MD_JWT_BEARER_GRANT =
  "urn:ietf:params:oauth:grant-type:jwt-bearer" as const;
export const AUTH_MD_CLAIM_GRANT =
  "urn:workos:agent-auth:grant-type:claim" as const;
export const AUTH_MD_ID_JAG_ASSERTION_TYPE =
  "urn:ietf:params:oauth:token-type:id-jag" as const;
export const AUTH_MD_IDENTITY_ASSERTION_REVOKED_EVENT =
  "https://schemas.workos.com/events/agent/auth/identity/assertion/revoked" as const;

export const AUTH_MD_IDENTITY_TYPES = [
  "service_auth",
  "identity_assertion",
  "anonymous",
] as const;

export type AuthMdIdentityType = (typeof AUTH_MD_IDENTITY_TYPES)[number];

export type AuthMdProtectedResourceMetadata = {
  resource: string;
  resource_name: string;
  resource_logo_uri?: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: ["header"];
};

export type AuthMdAgentAuthorizationMetadata = {
  skill: string;
  identity_endpoint: string;
  claim_endpoint: string;
  events_endpoint: string;
  identity_types_supported: AuthMdIdentityType[];
  identity_assertion?: {
    assertion_types_supported: [typeof AUTH_MD_ID_JAG_ASSERTION_TYPE];
  };
  events_supported: string[];
};

export type AuthMdAuthorizationServerMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: ["header"];
  issuer: string;
  token_endpoint: string;
  revocation_endpoint: string;
  grant_types_supported: [
    typeof AUTH_MD_JWT_BEARER_GRANT,
    typeof AUTH_MD_CLAIM_GRANT,
  ];
  agent_auth: AuthMdAgentAuthorizationMetadata;
};

export type AuthMdDiscoveryDocuments = {
  protectedResource: AuthMdProtectedResourceMetadata;
  authorizationServer: AuthMdAuthorizationServerMetadata;
};

export type CreateAuthMdDiscoveryDocumentsArgs = {
  resource: string;
  resourceName: string;
  resourceLogoUri?: string;
  issuer: string;
  scopesSupported: readonly string[];
  identityTypesSupported: readonly AuthMdIdentityType[];
};

export type CreateConvexAuthMdDiscoveryDocumentsArgs = Omit<
  CreateAuthMdDiscoveryDocumentsArgs,
  "identityTypesSupported"
>;

export function createConvexAuthMdDiscoveryDocuments(
  args: CreateConvexAuthMdDiscoveryDocumentsArgs
): AuthMdDiscoveryDocuments {
  return createAuthMdDiscoveryDocuments({
    ...args,
    identityTypesSupported: ["service_auth"],
  });
}

export function createAuthMdDiscoveryDocuments(
  args: CreateAuthMdDiscoveryDocumentsArgs
): AuthMdDiscoveryDocuments {
  const resource = readHttpsUrl(args.resource, "resource");
  const issuer = readIssuer(args.issuer);
  const resourceName = readNonEmptyValue(args.resourceName, "resourceName");
  const scopes = readScopes(args.scopesSupported);
  const identityTypes = readIdentityTypes(args.identityTypesSupported);
  const resourceOrigin = new URL(resource).origin;
  const issuerOrigin = new URL(issuer).origin;
  const skill = `${resourceOrigin}${AUTH_MD_DOCUMENT_PATH}`;
  const authorizationServers = [issuer];
  const resourceLogoUri =
    args.resourceLogoUri === undefined
      ? undefined
      : readHttpsUrl(args.resourceLogoUri, "resourceLogoUri");

  const protectedResource: AuthMdProtectedResourceMetadata = {
    resource,
    resource_name: resourceName,
    ...(resourceLogoUri === undefined
      ? {}
      : { resource_logo_uri: resourceLogoUri }),
    authorization_servers: authorizationServers,
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
  };

  const authorizationServer: AuthMdAuthorizationServerMetadata = {
    resource,
    authorization_servers: authorizationServers,
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
    issuer,
    token_endpoint: `${issuerOrigin}${AUTH_MD_TOKEN_ENDPOINT_PATH}`,
    revocation_endpoint: `${issuerOrigin}${AUTH_MD_REVOCATION_ENDPOINT_PATH}`,
    grant_types_supported: [AUTH_MD_JWT_BEARER_GRANT, AUTH_MD_CLAIM_GRANT],
    agent_auth: {
      skill,
      identity_endpoint: `${issuerOrigin}${AUTH_MD_IDENTITY_ENDPOINT_PATH}`,
      claim_endpoint: `${issuerOrigin}${AUTH_MD_CLAIM_ENDPOINT_PATH}`,
      events_endpoint: `${issuerOrigin}${AUTH_MD_EVENTS_ENDPOINT_PATH}`,
      identity_types_supported: identityTypes,
      ...(identityTypes.includes("identity_assertion")
        ? {
            identity_assertion: {
              assertion_types_supported: [AUTH_MD_ID_JAG_ASSERTION_TYPE],
            },
          }
        : {}),
      events_supported: identityTypes.includes("identity_assertion")
        ? [AUTH_MD_IDENTITY_ASSERTION_REVOKED_EVENT]
        : [],
    },
  };

  return parseAuthMdDiscoveryDocuments({
    protectedResource,
    authorizationServer,
  });
}

export function parseAuthMdDiscoveryDocuments(
  value: unknown
): AuthMdDiscoveryDocuments {
  const object = readObject(value, "auth.md discovery documents");
  const protectedResource = parseAuthMdProtectedResourceMetadata(
    object.protectedResource
  );
  const authorizationServer = parseAuthMdAuthorizationServerMetadata(
    object.authorizationServer
  );

  if (protectedResource.resource !== authorizationServer.resource) {
    throw new TypeError("auth.md discovery resource values must match");
  }
  if (
    !protectedResource.authorization_servers.includes(
      authorizationServer.issuer
    )
  ) {
    throw new TypeError(
      "protected resource metadata must authorize the declared issuer"
    );
  }
  if (
    !sameStringSet(
      protectedResource.scopes_supported,
      authorizationServer.scopes_supported
    )
  ) {
    throw new TypeError("auth.md discovery scope inventories must match");
  }

  return { protectedResource, authorizationServer };
}

export function parseAuthMdProtectedResourceMetadata(
  value: unknown
): AuthMdProtectedResourceMetadata {
  const object = readObject(value, "protected resource metadata");
  const resource = readHttpsUrl(
    readRequiredString(object, "resource"),
    "resource"
  );
  const resourceName = readRequiredString(object, "resource_name");
  const authorizationServers = readIssuerArray(
    object.authorization_servers,
    "authorization_servers"
  );
  const scopes = readScopes(object.scopes_supported);
  readHeaderBearerMethod(object.bearer_methods_supported);
  const logo = object.resource_logo_uri;
  const resourceLogoUri =
    logo === undefined
      ? undefined
      : readHttpsUrl(
          readRequiredString(object, "resource_logo_uri"),
          "resource_logo_uri"
        );

  return {
    resource,
    resource_name: resourceName,
    ...(resourceLogoUri === undefined
      ? {}
      : { resource_logo_uri: resourceLogoUri }),
    authorization_servers: authorizationServers,
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
  };
}

export function parseAuthMdAuthorizationServerMetadata(
  value: unknown
): AuthMdAuthorizationServerMetadata {
  const object = readObject(value, "authorization server metadata");
  const resource = readHttpsUrl(
    readRequiredString(object, "resource"),
    "resource"
  );
  const authorizationServers = readIssuerArray(
    object.authorization_servers,
    "authorization_servers"
  );
  const scopes = readScopes(object.scopes_supported);
  readHeaderBearerMethod(object.bearer_methods_supported);
  const issuer = readIssuer(readRequiredString(object, "issuer"));
  const issuerOrigin = new URL(issuer).origin;
  const tokenEndpoint = readIssuerEndpoint(
    object,
    "token_endpoint",
    issuerOrigin
  );
  const revocationEndpoint = readIssuerEndpoint(
    object,
    "revocation_endpoint",
    issuerOrigin
  );
  readRequiredGrantTypes(object.grant_types_supported);
  const agentAuth = readAgentAuthorizationMetadata(
    object.agent_auth,
    new URL(resource).origin,
    issuerOrigin
  );

  if (!authorizationServers.includes(issuer)) {
    throw new TypeError(
      "authorization server metadata must include its issuer"
    );
  }

  return {
    resource,
    authorization_servers: authorizationServers,
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
    issuer,
    token_endpoint: tokenEndpoint,
    revocation_endpoint: revocationEndpoint,
    grant_types_supported: [AUTH_MD_JWT_BEARER_GRANT, AUTH_MD_CLAIM_GRANT],
    agent_auth: agentAuth,
  };
}

export function createAuthMdBearerChallenge(
  resourceMetadataUrl: string
): string {
  const url = readHttpsUrl(resourceMetadataUrl, "resourceMetadataUrl");
  return `Bearer resource_metadata="${url}"`;
}

export function parseAuthMdBearerChallenge(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("WWW-Authenticate challenge must be a string");
  }
  const match = /^Bearer\s+resource_metadata="([^"]+)"$/i.exec(value.trim());
  const resourceMetadataUrl = match?.[1];
  if (resourceMetadataUrl === undefined) {
    throw new TypeError(
      "WWW-Authenticate challenge must contain one Bearer resource_metadata URL"
    );
  }
  return readHttpsUrl(resourceMetadataUrl, "resource_metadata");
}

function readAgentAuthorizationMetadata(
  value: unknown,
  resourceOrigin: string,
  issuerOrigin: string
): AuthMdAgentAuthorizationMetadata {
  const object = readObject(value, "agent_auth");
  const skill = readHttpsUrl(
    readRequiredString(object, "skill"),
    "agent_auth.skill"
  );
  const skillUrl = new URL(skill);
  if (
    skillUrl.origin !== resourceOrigin ||
    skillUrl.pathname !== AUTH_MD_DOCUMENT_PATH
  ) {
    throw new TypeError(
      "agent_auth.skill must be the resource origin /auth.md"
    );
  }
  const identityEndpoint = readIssuerEndpoint(
    object,
    "identity_endpoint",
    issuerOrigin
  );
  const claimEndpoint = readIssuerEndpoint(
    object,
    "claim_endpoint",
    issuerOrigin
  );
  const eventsEndpoint = readIssuerEndpoint(
    object,
    "events_endpoint",
    issuerOrigin
  );
  const identityTypes = readIdentityTypes(object.identity_types_supported);
  const events = readStringArray(
    object.events_supported,
    "agent_auth.events_supported",
    {
      allowEmpty: true,
    }
  );
  const identityAssertion = object.identity_assertion;

  if (identityTypes.includes("identity_assertion")) {
    const assertionObject = readObject(
      identityAssertion,
      "agent_auth.identity_assertion"
    );
    const assertionTypes = readStringArray(
      assertionObject.assertion_types_supported,
      "agent_auth.identity_assertion.assertion_types_supported",
      { allowEmpty: false }
    );
    if (
      assertionTypes.length !== 1 ||
      assertionTypes[0] !== AUTH_MD_ID_JAG_ASSERTION_TYPE
    ) {
      throw new TypeError("identity_assertion must advertise only ID-JAG");
    }
    if (!events.includes(AUTH_MD_IDENTITY_ASSERTION_REVOKED_EVENT)) {
      throw new TypeError(
        "identity_assertion must advertise upstream revocation events"
      );
    }
  } else if (identityAssertion !== undefined) {
    throw new TypeError(
      "identity_assertion metadata requires the identity_assertion flow"
    );
  }

  return {
    skill,
    identity_endpoint: identityEndpoint,
    claim_endpoint: claimEndpoint,
    events_endpoint: eventsEndpoint,
    identity_types_supported: identityTypes,
    ...(identityTypes.includes("identity_assertion")
      ? {
          identity_assertion: {
            assertion_types_supported: [AUTH_MD_ID_JAG_ASSERTION_TYPE],
          },
        }
      : {}),
    events_supported: events,
  };
}

function readIssuer(value: string): string {
  const parsed = readHttpsUrl(value, "issuer");
  const url = new URL(parsed);
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new TypeError("issuer must not contain a query or fragment");
  }
  return parsed.endsWith("/") ? parsed.slice(0, -1) : parsed;
}

function readIssuerEndpoint(
  object: Record<string, unknown>,
  key: string,
  issuerOrigin: string
): string {
  const endpoint = readHttpsUrl(readRequiredString(object, key), key);
  if (new URL(endpoint).origin !== issuerOrigin) {
    throw new TypeError(`${key} must use the issuer origin`);
  }
  return endpoint;
}

function readScopes(value: unknown): string[] {
  const scopes = readStringArray(value, "scopes_supported", {
    allowEmpty: false,
  });
  for (const scope of scopes) {
    if (!isOAuthScopeToken(scope)) {
      throw new TypeError(`Invalid OAuth scope token ${scope}`);
    }
  }
  return scopes;
}

function readIdentityTypes(value: unknown): AuthMdIdentityType[] {
  return readStringArray(value, "identity_types_supported", {
    allowEmpty: false,
  }).map((identityType) => {
    if (!isAuthMdIdentityType(identityType)) {
      throw new TypeError(`Unsupported auth.md identity type ${identityType}`);
    }
    return identityType;
  });
}

function readIssuerArray(value: unknown, name: string): string[] {
  return readStringArray(value, name, { allowEmpty: false }).map((item) =>
    readIssuer(item)
  );
}

function readHeaderBearerMethod(value: unknown): void {
  const methods = readStringArray(value, "bearer_methods_supported", {
    allowEmpty: false,
  });
  if (methods.length !== 1 || methods[0] !== "header") {
    throw new TypeError("bearer_methods_supported must contain only header");
  }
}

function readRequiredGrantTypes(value: unknown): void {
  const grants = readStringArray(value, "grant_types_supported", {
    allowEmpty: false,
  });
  if (
    !grants.includes(AUTH_MD_JWT_BEARER_GRANT) ||
    !grants.includes(AUTH_MD_CLAIM_GRANT)
  ) {
    throw new TypeError(
      "grant_types_supported must include JWT bearer and auth.md claim grants"
    );
  }
}

function readNonEmptyValue(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function isOAuthScopeToken(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (
      code === undefined ||
      code < 0x21 ||
      code > 0x7e ||
      code === 0x22 ||
      code === 0x5c
    ) {
      return false;
    }
  }
  return value.length > 0;
}

function isAuthMdIdentityType(value: string): value is AuthMdIdentityType {
  return AUTH_MD_IDENTITY_TYPES.some((identityType) => identityType === value);
}

function sameStringSet(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length && left.every((value) => right.includes(value))
  );
}
