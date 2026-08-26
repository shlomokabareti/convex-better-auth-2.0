import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import {
  AUTH_MD_CLAIM_GRANT,
  AUTH_MD_ID_JAG_ASSERTION_TYPE,
  AUTH_MD_IDENTITY_ASSERTION_REVOKED_EVENT,
  AUTH_MD_JWT_BEARER_GRANT,
  createAuthMdServiceAuthChallenge,
  createAuthMdBearerChallenge,
  createAuthMdDiscoveryDocuments,
  createAuthMdDocument,
  createConvexAuthMdDiscoveryDocuments,
  hashAuthMdLoginHint,
  hashAuthMdUserCode,
  normalizeAuthMdLoginHint,
  normalizeAuthMdUserCode,
  parseAuthMdBearerChallenge,
  parseAuthMdDiscoveryDocuments,
} from "./auth-md";

const serviceAuthDiscovery = createConvexAuthMdDiscoveryDocuments({
  resource: "https://chat.example.com",
  resourceName: "Convex Chat",
  resourceLogoUri: "https://example.com/chat-logo.png",
  issuer: "https://auth.example.com",
  scopesSupported: ["chat:read", "chat:write"],
});

describe("auth.md discovery contract", () => {
  it("generates the constrained Convex service_auth profile", () => {
    assert.deepEqual(serviceAuthDiscovery, {
      protectedResource: {
        resource: "https://chat.example.com/",
        resource_name: "Convex Chat",
        resource_logo_uri: "https://example.com/chat-logo.png",
        authorization_servers: ["https://auth.example.com"],
        scopes_supported: ["chat:read", "chat:write"],
        bearer_methods_supported: ["header"],
      },
      authorizationServer: {
        resource: "https://chat.example.com/",
        authorization_servers: ["https://auth.example.com"],
        scopes_supported: ["chat:read", "chat:write"],
        bearer_methods_supported: ["header"],
        issuer: "https://auth.example.com",
        token_endpoint: "https://auth.example.com/oauth2/token",
        revocation_endpoint: "https://auth.example.com/oauth2/revoke",
        grant_types_supported: [AUTH_MD_JWT_BEARER_GRANT, AUTH_MD_CLAIM_GRANT],
        agent_auth: {
          skill: "https://chat.example.com/auth.md",
          identity_endpoint: "https://auth.example.com/agent/identity",
          claim_endpoint: "https://auth.example.com/agent/identity/claim",
          events_endpoint: "https://auth.example.com/agent/event/notify",
          identity_types_supported: ["service_auth"],
          events_supported: [],
        },
      },
    });
    assert.ok(!("identity_assertion" in serviceAuthDiscovery.authorizationServer.agent_auth));
  });

  it("parses the standard identity_assertion profile only with ID-JAG revocation", () => {
    const discovery = createAuthMdDiscoveryDocuments({
      resource: "https://api.example.com",
      resourceName: "Example API",
      issuer: "https://auth.example.com",
      scopesSupported: ["records:read"],
      identityTypesSupported: ["identity_assertion"],
    });

    assert.deepEqual(discovery.authorizationServer.agent_auth.identity_assertion, {
      assertion_types_supported: [AUTH_MD_ID_JAG_ASSERTION_TYPE],
    });
    assert.deepEqual(discovery.authorizationServer.agent_auth.events_supported, [
      AUTH_MD_IDENTITY_ASSERTION_REVOKED_EVENT,
    ]);

    const missingRevocation = structuredClone(discovery);
    missingRevocation.authorizationServer.agent_auth.events_supported = [];
    expect(() => parseAuthMdDiscoveryDocuments(missingRevocation)).toThrow(/revocation events/);

    const missingAssertion = structuredClone(discovery);
    delete missingAssertion.authorizationServer.agent_auth.identity_assertion;
    expect(() => parseAuthMdDiscoveryDocuments(missingAssertion)).toThrow(/identity_assertion/);
  });

  it("ignores unknown fields and treats scope inventories as sets", () => {
    const input = structuredClone(serviceAuthDiscovery);
    input.authorizationServer.scopes_supported.reverse();
    const withExtensions: unknown = {
      ...input,
      future_top_level: true,
      protectedResource: {
        ...input.protectedResource,
        future_resource_field: { ignored: true },
      },
      authorizationServer: {
        ...input.authorizationServer,
        future_server_field: "ignored",
      },
    };

    const parsed = parseAuthMdDiscoveryDocuments(withExtensions);
    assert.deepEqual(parsed.authorizationServer.scopes_supported, ["chat:write", "chat:read"]);
    assert.ok(!("future_top_level" in parsed));
    assert.ok(!("future_resource_field" in parsed.protectedResource));
  });

  it("rejects insecure URLs, endpoint injection, mismatches, and invalid grants", () => {
    expect(() =>
      createConvexAuthMdDiscoveryDocuments({
        resource: "http://chat.example.com",
        resourceName: "Convex Chat",
        issuer: "https://auth.example.com",
        scopesSupported: ["chat:read"],
      }),
    ).toThrow(/must use https/);

    const crossOriginEndpoint = structuredClone(serviceAuthDiscovery);
    crossOriginEndpoint.authorizationServer.token_endpoint = "https://evil.example/token";
    expect(() => parseAuthMdDiscoveryDocuments(crossOriginEndpoint)).toThrow(/issuer origin/);

    const wrongSkill = structuredClone(serviceAuthDiscovery);
    wrongSkill.authorizationServer.agent_auth.skill = "https://chat.example.com/not-auth.md";
    expect(() => parseAuthMdDiscoveryDocuments(wrongSkill)).toThrow(/resource origin \/auth\.md/);

    const mismatchedScopes = structuredClone(serviceAuthDiscovery);
    mismatchedScopes.authorizationServer.scopes_supported = ["admin"];
    expect(() => parseAuthMdDiscoveryDocuments(mismatchedScopes)).toThrow(
      /scope inventories must match/,
    );

    const invalidGrants: unknown = {
      ...serviceAuthDiscovery,
      authorizationServer: {
        ...serviceAuthDiscovery.authorizationServer,
        grant_types_supported: [AUTH_MD_JWT_BEARER_GRANT, AUTH_MD_JWT_BEARER_GRANT],
      },
    };
    expect(() => parseAuthMdDiscoveryDocuments(invalidGrants)).toThrow(/duplicates|claim grants/);

    expect(() =>
      createConvexAuthMdDiscoveryDocuments({
        resource: "https://chat.example.com",
        resourceName: "Convex Chat",
        issuer: "https://auth.example.com",
        scopesSupported: ["chat:read", "chat:read"],
      }),
    ).toThrow(/duplicates/);
  });
});

describe("auth.md human-readable and challenge contracts", () => {
  it("renders deterministic documentation from structured metadata", () => {
    const document = createAuthMdDocument({
      serviceName: "Convex Chat",
      description: "Human and agent collaboration for Convex organizations.",
      discovery: serviceAuthDiscovery,
      scopeDescriptions: {
        "chat:read": "Read authorized room context.",
        "chat:write": "Post authorized room activity.",
      },
      termsUrl: "https://example.com/terms",
      privacyUrl: "https://example.com/privacy",
      contact: "security@example.com",
    });

    expect(document).toContain("# Convex Chat agent authentication");
    expect(document).toContain("`service_auth`");
    expect(document).not.toContain("`anonymous`");
    expect(document).not.toContain("`identity_assertion`");
    expect(document).toContain("`chat:read` — Read authorized room context.");
    expect(document).toContain(
      "The structured metadata is authoritative. This document is its human-readable summary.",
    );
    assert.equal(
      document,
      createAuthMdDocument({
        serviceName: "Convex Chat",
        description: "Human and agent collaboration for Convex organizations.",
        discovery: serviceAuthDiscovery,
        scopeDescriptions: {
          "chat:read": "Read authorized room context.",
          "chat:write": "Post authorized room activity.",
        },
        termsUrl: "https://example.com/terms",
        privacyUrl: "https://example.com/privacy",
        contact: "security@example.com",
      }),
    );
  });

  it("round-trips the protected-resource challenge and rejects ambiguity", () => {
    const metadataUrl = "https://chat.example.com/.well-known/oauth-protected-resource";
    const challenge = createAuthMdBearerChallenge(metadataUrl);
    assert.equal(challenge, `Bearer resource_metadata="${metadataUrl}"`);
    assert.equal(parseAuthMdBearerChallenge(challenge), metadataUrl);
    expect(() =>
      parseAuthMdBearerChallenge(`Bearer resource_metadata="${metadataUrl}", realm="extra"`),
    ).toThrow(/one Bearer resource_metadata URL/);
  });

  it("rejects missing scope descriptions and multiline markdown injection", () => {
    expect(() =>
      createAuthMdDocument({
        serviceName: "Convex Chat",
        description: "Description",
        discovery: serviceAuthDiscovery,
        scopeDescriptions: { "chat:read": "Read rooms" },
        contact: "security@example.com",
      }),
    ).toThrow(/scopeDescriptions\.chat:write/);

    expect(() =>
      createAuthMdDocument({
        serviceName: "Convex Chat\n# Injected",
        description: "Description",
        discovery: serviceAuthDiscovery,
        scopeDescriptions: {
          "chat:read": "Read rooms",
          "chat:write": "Write rooms",
        },
        contact: "security@example.com",
      }),
    ).toThrow(/single line/);
  });
});

describe("auth.md service_auth ceremony secrets", () => {
  it("generates bounded one-time secrets and stores only stable digests", async () => {
    let nextByte = 0;
    const challenge = await createAuthMdServiceAuthChallenge({
      now: 1_800_000_000_000,
      randomBytes: (length) =>
        Uint8Array.from({ length }, () => {
          const value = nextByte % 250;
          nextByte += 1;
          return value;
        }),
    });

    assert.match(challenge.claimToken, /^clm_[A-Za-z0-9_-]{43}$/u);
    assert.match(challenge.claimViewToken, /^cvt_[A-Za-z0-9_-]{43}$/u);
    assert.match(challenge.userCode, /^\d{6}$/u);
    assert.match(challenge.claimTokenHash, /^[A-Za-z0-9_-]{43}$/u);
    assert.match(challenge.claimViewTokenHash, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(challenge.userCodeHash, await hashAuthMdUserCode(challenge.userCode));
    assert.equal(challenge.expiresIn, 900);
    assert.equal(challenge.userCodeExpiresIn, 600);
    assert.equal(challenge.interval, 5);
  });

  it("normalizes email hints and six-digit user codes before hashing", async () => {
    assert.equal(normalizeAuthMdLoginHint(" Owner@Example.COM "), "owner@example.com");
    assert.equal(normalizeAuthMdUserCode("123-456"), "123456");
    assert.equal(
      await hashAuthMdLoginHint(" Owner@Example.COM "),
      await hashAuthMdLoginHint("owner@example.com"),
    );
    expect(() => normalizeAuthMdLoginHint("not-an-email")).toThrow(/email/);
    expect(() => normalizeAuthMdUserCode("12345")).toThrow(/six digits/);
  });

  it("rejects invalid lifetimes, cadence, and entropy sources", async () => {
    await expect(createAuthMdServiceAuthChallenge({ expiresIn: 901 })).rejects.toThrow(/expiresIn/);
    await expect(createAuthMdServiceAuthChallenge({ interval: 61 })).rejects.toThrow(/interval/);
    await expect(
      createAuthMdServiceAuthChallenge({
        randomBytes: () => new Uint8Array(1),
      }),
    ).rejects.toThrow(/entropy source/);
  });
});
