import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  buildAuthorizationServerMetadata,
  buildEmptyJwks,
  buildMcpOAuthIssuer,
  buildMcpOAuthPaths,
  buildProtectedResourceMetadata,
  createMcpOAuthProtocolConfig,
  resolveRequestOrigin,
} from "./protocol";

const config = {
  resourceSlug: "crm-mcp",
  resourceId: "crm:mcp",
  audience: "crm-mcp",
  scopesSupported: ["crm:organization:read", "crm:opportunities:write"],
} as const;

describe("mcp protocol helpers", () => {
  it("builds stable default paths", () => {
    assert.deepEqual(buildMcpOAuthPaths(config), {
      issuerPath: "/oauth/crm-mcp",
      mcpPath: "/mcp",
      authorizationServerMetadataPath:
        "/.well-known/oauth-authorization-server/crm-mcp",
      protectedResourceMetadataPath:
        "/.well-known/oauth-protected-resource/crm-mcp",
      jwksPath: "/oauth/crm-mcp/jwks",
      authorizePath: "/oauth/crm-mcp/authorize",
      tokenPath: "/oauth/crm-mcp/token",
      registrationPath: "/oauth/crm-mcp/register",
    });
  });

  it("builds authorization metadata", () => {
    assert.deepEqual(
      buildAuthorizationServerMetadata("https://crm.test", config),
      {
        issuer: "https://crm.test/oauth/crm-mcp",
        authorization_endpoint: "https://crm.test/oauth/crm-mcp/authorize",
        token_endpoint: "https://crm.test/oauth/crm-mcp/token",
        registration_endpoint: "https://crm.test/oauth/crm-mcp/register",
        jwks_uri: "https://crm.test/oauth/crm-mcp/jwks",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["crm:organization:read", "crm:opportunities:write"],
        resource: "crm:mcp",
      }
    );
  });

  it("builds protected resource metadata", () => {
    assert.deepEqual(
      buildProtectedResourceMetadata("https://crm.test", config),
      {
        resource: "crm:mcp",
        authorization_servers: ["https://crm.test/oauth/crm-mcp"],
        jwks_uri: "https://crm.test/oauth/crm-mcp/jwks",
        bearer_methods_supported: ["header"],
        scopes_supported: ["crm:organization:read", "crm:opportunities:write"],
      }
    );
  });

  it("normalizes protocol config", () => {
    assert.deepEqual(
      createMcpOAuthProtocolConfig({
        resourceSlug: " crm-mcp ",
        resourceId: " crm:mcp ",
        audience: " crm-mcp ",
        oauthBasePath: "/oauth/",
        scopesSupported: [
          "crm:organization:read",
          "crm:organization:read",
          "  ",
        ],
      }),
      {
        resourceSlug: "crm-mcp",
        resourceId: "crm:mcp",
        audience: "crm-mcp",
        scopesSupported: ["crm:organization:read"],
        mcpPath: "/mcp",
        oauthBasePath: "/oauth",
        issuerPath: "/oauth/crm-mcp",
        responseTypesSupported: ["code"],
        grantTypesSupported: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethodsSupported: ["none"],
        codeChallengeMethodsSupported: ["S256"],
        bearerMethodsSupported: ["header"],
        clientIdMetadataDocumentSupported: false,
      }
    );
  });

  it("resolves request origin and empty jwks", () => {
    assert.equal(
      resolveRequestOrigin(
        new Request("https://crm.test/oauth/crm-mcp/authorize")
      ),
      "https://crm.test"
    );
    assert.equal(
      buildMcpOAuthIssuer("https://crm.test", config),
      "https://crm.test/oauth/crm-mcp"
    );
    assert.deepEqual(buildEmptyJwks(), { keys: [] });
  });
});
