import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  buildMcpOAuthDynamicClientRegistrationResponse,
  createMcpOAuthDynamicClient,
  parseMcpOAuthAuthorizeRequest,
  parseMcpOAuthDynamicClientRegistrationRequest,
  validateMcpOAuthAuthorizationCodeTokenExchange,
} from "./flow";
const policy = {
  supportedScopes: ["crm:organization:read", "crm:tasks:read"],
} as const;

describe("mcp oauth flow helpers", () => {
  it("parses authorize request with defaults", () => {
    const parsed = parseMcpOAuthAuthorizeRequest(
      new Request(
        "https://crm.test/oauth/crm-mcp/authorize?response_type=code&client_id=client_123&redirect_uri=http://127.0.0.1:8788/callback&code_challenge=challenge_123&code_challenge_method=S256&scope=crm:organization:read&state=state_123"
      ),
      {
        defaultAudience: "crm-mcp",
        defaultResourceId: "crm:mcp",
      }
    );

    assert.deepEqual(parsed, {
      audience: "crm-mcp",
      clientId: "client_123",
      codeChallenge: "challenge_123",
      expiresInMs: undefined,
      organizationId: null,
      redirectUri: "http://127.0.0.1:8788/callback",
      resourceId: "crm:mcp",
      scope: "crm:organization:read",
      state: "state_123",
    });
  });

  it("parses dynamic client registration body", () => {
    const parsed = parseMcpOAuthDynamicClientRegistrationRequest({
      client_name: "CRM Generated Client",
      redirect_uris: ["http://127.0.0.1:8788/callback"],
      scope: "crm:organization:read crm:tasks:read",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });

    assert.deepEqual(parsed, {
      clientName: "CRM Generated Client",
      redirectUris: ["http://127.0.0.1:8788/callback"],
      scope: "crm:organization:read crm:tasks:read",
      tokenEndpointAuthMethod: undefined,
      grantTypes: ["authorization_code"],
      responseTypes: ["code"],
      softwareId: undefined,
      softwareVersion: undefined,
    });
  });

  it("normalizes native Cloudflare Agents SDK null software metadata", () => {
    const parsed = parseMcpOAuthDynamicClientRegistrationRequest({
      client_name: "Cloudflare Agents SDK",
      redirect_uris: ["http://127.0.0.1:8788/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      software_id: null,
      software_version: null,
    });

    assert.equal(parsed.softwareId, undefined);
    assert.equal(parsed.softwareVersion, undefined);
  });

  it("creates persisted dynamic client and response payload", async () => {
    const persisted = await createMcpOAuthDynamicClient({
      input: {
        clientName: "CRM Generated Client",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        scope: "crm:organization:read crm:tasks:read",
      },
      policy,
      clientId: "crm-mcp-generated-client",
      now: 1_700_000_000_000,
      persist: (record) => record,
    });

    assert.deepEqual(persisted.persisted, {
      clientId: "crm-mcp-generated-client",
      name: "CRM Generated Client",
      redirectUris: ["http://127.0.0.1:8788/callback"],
      allowedScopes: ["crm:organization:read", "crm:tasks:read"],
      tokenEndpointAuthMethod: "none",
      pkceRequired: true,
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      softwareId: undefined,
      softwareVersion: undefined,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    });

    assert.deepEqual(
      buildMcpOAuthDynamicClientRegistrationResponse(
        persisted.client,
        persisted.clientIdIssuedAt
      ),
      {
        client_id: "crm-mcp-generated-client",
        client_id_issued_at: 1_700_000_000,
        client_name: "CRM Generated Client",
        redirect_uris: ["http://127.0.0.1:8788/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "crm:organization:read crm:tasks:read",
      }
    );
  });

  it("preserves string software metadata in registration responses", () => {
    const response = buildMcpOAuthDynamicClientRegistrationResponse(
      {
        clientId: "crm-mcp-versioned-client",
        name: "Versioned Client",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
        tokenEndpointAuthMethod: "none",
        grantTypes: ["authorization_code"],
        responseTypes: ["code"],
        pkceRequired: true,
        softwareId: "cloudflare-agents",
        softwareVersion: "1.2.3",
      },
      1_700_000_000
    );

    assert.equal(response.software_id, "cloudflare-agents");
    assert.equal(response.software_version, "1.2.3");
  });

  it("validates authorization code token exchange", async () => {
    const result = await validateMcpOAuthAuthorizationCodeTokenExchange({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "code_123",
          client_id: "client_123",
          redirect_uri: "http://127.0.0.1:8788/callback",
          code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        }),
      }),
      resolveClient: () => ({
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
      }),
      consumeAuthorizationCode: () => ({
        clientId: "client_123",
        betterAuthUserId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read"],
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        codeChallengeMethod: "S256",
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        expiresAt: 2_000,
      }),
      now: 1_000,
    });

    assert.deepEqual(result, {
      ok: true,
      client: {
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
      },
      authorizationCode: {
        clientId: "client_123",
        betterAuthUserId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read"],
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        codeChallengeMethod: "S256",
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        expiresAt: 2_000,
      },
    });
  });

  it("rejects a stored authorization code whose scope exceeds the client", async () => {
    const result = await validateMcpOAuthAuthorizationCodeTokenExchange({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "code_123",
          client_id: "management-client",
          redirect_uri: "http://127.0.0.1:8788/callback",
          code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        }),
      }),
      resolveClient: () => ({
        clientId: "management-client",
        name: "Convex Management",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
      }),
      consumeAuthorizationCode: () => ({
        clientId: "management-client",
        betterAuthUserId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:growth:write"],
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        codeChallengeMethod: "S256",
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        expiresAt: 2_000,
      }),
      now: 1_000,
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Authorization code scope is not allowed for client",
      },
    });
  });

  it("rejects an expired authorization code during token exchange", async () => {
    const result = await validateMcpOAuthAuthorizationCodeTokenExchange({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "code_123",
          client_id: "client_123",
          redirect_uri: "http://127.0.0.1:8788/callback",
          code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        }),
      }),
      resolveClient: () => ({
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
      }),
      // Valid PKCE so the ONLY reason this fails is expiry — proving the expiry
      // gate runs and is not masked by the PKCE check.
      consumeAuthorizationCode: () => ({
        clientId: "client_123",
        betterAuthUserId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read"],
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        codeChallengeMethod: "S256",
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        expiresAt: 1_000,
      }),
      now: 1_000, // now === expiresAt → expired (boundary is inclusive)
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Authorization code expired",
      },
    });
  });

  it("fails closed when a consumed code carries no numeric expiry", async () => {
    const result: unknown = await Reflect.apply(
      validateMcpOAuthAuthorizationCodeTokenExchange,
      undefined,
      [
        {
          request: new Request("https://crm.test/oauth/crm-mcp/token", {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code: "code_123",
              client_id: "client_123",
              redirect_uri: "http://127.0.0.1:8788/callback",
              code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
            }),
          }),
          resolveClient: () => ({
            clientId: "client_123",
            name: "Client 123",
            redirectUris: ["http://127.0.0.1:8788/callback"],
            allowedScopes: ["crm:organization:read"],
          }),
          // A misbehaving consumer that ignored the contract and dropped expiresAt.
          // The validator must reject rather than treat it as never-expiring.
          consumeAuthorizationCode: () => ({
            clientId: "client_123",
            betterAuthUserId: "user_123",
            organizationId: "org_123",
            scopes: ["crm:organization:read"],
            codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
            codeChallengeMethod: "S256",
            audience: "crm-mcp",
            resourceId: "crm:mcp",
          }),
          now: 1_000,
        },
      ]
    );

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Authorization code expired",
      },
    });
  });

  it("rejects pkce mismatch during token exchange", async () => {
    const result = await validateMcpOAuthAuthorizationCodeTokenExchange({
      request: new Request("https://crm.test/oauth/crm-mcp/token", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "code_123",
          client_id: "client_123",
          redirect_uri: "http://127.0.0.1:8788/callback",
          code_verifier: "wrong-verifier",
        }),
      }),
      resolveClient: () => ({
        clientId: "client_123",
        name: "Client 123",
        redirectUris: ["http://127.0.0.1:8788/callback"],
        allowedScopes: ["crm:organization:read"],
      }),
      consumeAuthorizationCode: () => ({
        clientId: "client_123",
        betterAuthUserId: "user_123",
        organizationId: "org_123",
        scopes: ["crm:organization:read"],
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        codeChallengeMethod: "S256",
        audience: "crm-mcp",
        resourceId: "crm:mcp",
        expiresAt: 2_000,
      }),
      now: 1_000,
    });

    assert.deepEqual(result, {
      ok: false,
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "PKCE verifier mismatch",
      },
    });
  });
});
