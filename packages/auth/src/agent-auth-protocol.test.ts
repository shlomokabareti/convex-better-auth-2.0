import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import {
  AGENT_AUTH_PROTOCOL_DISCOVERY_CACHE_CONTROL,
  AGENT_AUTH_PROTOCOL_DISCOVERY_PATH,
  AGENT_AUTH_PROTOCOL_VERSION,
  assertSupportedAgentAuthProtocolVersion,
  createAgentAuthProtocolDiscoveryDocument,
  createAgentAuthProtocolErrorResponse,
  parseAgentAuthProtocolAgentJwt,
  parseAgentAuthProtocolDiscoveryDocument,
  parseAgentAuthProtocolErrorResponse,
  parseAgentAuthProtocolHostJwt,
  parseAgentAuthProtocolVersion,
  resolveAgentAuthProtocolDefaultLocation,
  resolveAgentAuthProtocolErrorHttpStatus,
  type AgentAuthProtocolEndpoints,
} from "./agent-auth-protocol";

const endpoints: AgentAuthProtocolEndpoints = {
  register: "/agent/register",
  capabilities: "/capability/list",
  describe_capability: "/capability/describe",
  execute: "/capability/execute",
  request_capability: "/agent/request-capability",
  status: "/agent/status",
  reactivate: "/agent/reactivate",
  revoke: "/agent/revoke",
  revoke_host: "/host/revoke",
  rotate_key: "/agent/rotate-key",
  rotate_host_key: "/host/rotate-key",
  introspect: "/agent/introspect",
};

const publicKey = {
  kty: "OKP",
  crv: "Ed25519",
  x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
} as const;

describe("Agent Auth Protocol discovery contract", () => {
  it("generates only the complete pinned Convex server profile", () => {
    const document = createAgentAuthProtocolDiscoveryDocument({
      provider_name: "convex",
      description: "Convex Agent Auth",
      issuer: "https://convex-auth.example.com/",
      modes: ["delegated", "autonomous"],
      approval_methods: ["device_authorization"],
      endpoints,
      jwks_uri: "https://convex-auth.example.com/.well-known/jwks.json",
    });

    assert.deepEqual(document, {
      version: "1.0-draft",
      provider_name: "convex",
      description: "Convex Agent Auth",
      issuer: "https://convex-auth.example.com/",
      algorithms: ["Ed25519"],
      modes: ["delegated", "autonomous"],
      approval_methods: ["device_authorization"],
      endpoints,
      jwks_uri: "https://convex-auth.example.com/.well-known/jwks.json",
    });
    assert.equal(
      resolveAgentAuthProtocolDefaultLocation(document),
      "https://convex-auth.example.com/capability/execute"
    );
    assert.equal(
      AGENT_AUTH_PROTOCOL_DISCOVERY_PATH,
      "/.well-known/agent-configuration"
    );
    assert.equal(
      AGENT_AUTH_PROTOCOL_DISCOVERY_CACHE_CONTROL,
      "public, max-age=3600"
    );
  });

  it("ignores unknown response fields but rejects an unknown draft or major", () => {
    const document = parseAgentAuthProtocolDiscoveryDocument({
      version: AGENT_AUTH_PROTOCOL_VERSION,
      provider_name: "convex",
      description: "Convex Agent Auth",
      issuer: "https:/convex-auth.example.com",
      algorithms: ["Ed25519"],
      modes: ["delegated"],
      approval_methods: ["device_authorization", "convex_extension"],
      endpoints,
      future_field: { ignored: true },
    });
    assert.equal(document.provider_name, "convex");
    assert.deepEqual(parseAgentAuthProtocolVersion("1.3-draft"), {
      raw: "1.3-draft",
      major: 1,
      minor: 3,
      draft: true,
    });
    expect(() => assertSupportedAgentAuthProtocolVersion("2.0")).toThrow(
      /major version 2/
    );
    expect(() => assertSupportedAgentAuthProtocolVersion("1.1-draft")).toThrow(
      /expected 1\.0-draft/
    );
  });

  it("refuses incomplete, downgraded, or misleading discovery", () => {
    const base = {
      version: AGENT_AUTH_PROTOCOL_VERSION,
      provider_name: "convex",
      description: "Convex Agent Auth",
      issuer: "https:/convex-auth.example.com",
      algorithms: ["Ed25519"],
      modes: ["delegated"],
      approval_methods: ["device_authorization"],
      endpoints,
    };
    expect(() =>
      parseAgentAuthProtocolDiscoveryDocument({
        ...base,
        algorithms: ["RS256"],
      })
    ).toThrow(/only Ed25519/);
    expect(() =>
      parseAgentAuthProtocolDiscoveryDocument({
        ...base,
        approval_methods: ["ciba"],
      })
    ).toThrow(/device_authorization/);
    expect(() =>
      parseAgentAuthProtocolDiscoveryDocument({
        ...base,
        endpoints: { ...endpoints, introspect: "https://evil.example/path" },
      })
    ).toThrow(/issuer-relative/);
    const { status: _status, ...missingStatus } = endpoints;
    expect(() =>
      parseAgentAuthProtocolDiscoveryDocument({
        ...base,
        endpoints: missingStatus,
      })
    ).toThrow(/status must be/);
    expect(() =>
      parseAgentAuthProtocolDiscoveryDocument({
        ...base,
        issuer: "http:/convex-auth.example.com",
      })
    ).toThrow(/must use https/);
  });
});

describe("Agent Auth Protocol JWT wire contract", () => {
  it("parses inline host registration without inventing a sub claim", () => {
    const parsed = parseAgentAuthProtocolHostJwt({
      registration: true,
      header: { alg: "EdDSA", typ: "host+jwt" },
      claims: {
        iss: "host-thumbprint",
        aud: "https:/convex-auth.example.com",
        iat: 1_710_000_000,
        exp: 1_710_000_060,
        jti: "host-jti",
        host_public_key: publicKey,
        agent_public_key: publicKey,
      },
    });
    assert.equal(parsed.header.typ, "host+jwt");
    assert.ok(!("sub" in parsed.claims));
    assert.deepEqual(parsed.claims.host_public_key, publicKey);
  });

  it("parses the base agent profile without Convex request-binding claims", () => {
    const parsed = parseAgentAuthProtocolAgentJwt({
      header: { alg: "EdDSA", typ: "agent+jwt" },
      claims: {
        iss: "host-thumbprint",
        sub: "agent-1",
        aud: "https://convex-auth.example.com/capability/execute",
        iat: 1_710_000_000,
        exp: 1_710_000_060,
        jti: "agent-jti",
        capabilities: ["read_errors"],
      },
    });
    assert.equal(parsed.claims.sub, "agent-1");
    assert.ok(!("htm" in parsed.claims));
    assert.ok(!("htu" in parsed.claims));
    assert.ok(!("ath" in parsed.claims));
  });

  it("rejects token confusion, private keys, and ambiguous key sources", () => {
    expect(() =>
      parseAgentAuthProtocolAgentJwt({
        header: { alg: "EdDSA", typ: "host+jwt" },
        claims: {
          iss: "host",
          sub: "agent",
          aud: "https:/convex-auth.example.com",
          iat: 1,
          exp: 2,
          jti: "jti",
        },
      })
    ).toThrow(/agent\+jwt/);
    expect(() =>
      parseAgentAuthProtocolHostJwt({
        registration: true,
        header: { alg: "EdDSA", typ: "host+jwt" },
        claims: {
          iss: "host",
          aud: "https:/convex-auth.example.com",
          iat: 1,
          exp: 2,
          jti: "jti",
          host_public_key: { ...publicKey, d: "private" },
          agent_public_key: publicKey,
        },
      })
    ).toThrow(/private key material/);
    expect(() =>
      parseAgentAuthProtocolHostJwt({
        registration: true,
        header: { alg: "EdDSA", typ: "host+jwt" },
        claims: {
          iss: "host",
          aud: "https:/convex-auth.example.com",
          iat: 1,
          exp: 2,
          jti: "jti",
          host_public_key: publicKey,
          host_jwks_url: "https://host.example/jwks",
          agent_public_key: publicKey,
        },
      })
    ).toThrow(/Exactly one/);
  });

  it("requires kid for JWKS hosts and a registration agent key", () => {
    expect(() =>
      parseAgentAuthProtocolHostJwt({
        registration: false,
        header: { alg: "EdDSA", typ: "host+jwt" },
        claims: {
          iss: "host",
          aud: "https:/convex-auth.example.com",
          iat: 1,
          exp: 2,
          jti: "jti",
          host_jwks_url: "https://host.example/jwks",
        },
      })
    ).toThrow(/header kid/);
    expect(() =>
      parseAgentAuthProtocolHostJwt({
        registration: true,
        header: { alg: "EdDSA", typ: "host+jwt" },
        claims: {
          iss: "host",
          aud: "https:/convex-auth.example.com",
          iat: 1,
          exp: 2,
          jti: "jti",
          host_public_key: publicKey,
        },
      })
    ).toThrow(/registration host JWT requires/);
  });
});

describe("Agent Auth Protocol errors", () => {
  it("creates standard errors without allowing extension overrides", () => {
    assert.deepEqual(
      createAgentAuthProtocolErrorResponse({
        error: "invalid_capabilities",
        message: "Unknown capability",
        extensions: { invalid_capabilities: ["unknown"] },
      }),
      {
        error: "invalid_capabilities",
        message: "Unknown capability",
        invalid_capabilities: ["unknown"],
      }
    );
    assert.equal(
      resolveAgentAuthProtocolErrorHttpStatus("invalid_capabilities"),
      400
    );
    assert.equal(
      resolveAgentAuthProtocolErrorHttpStatus("future_extension"),
      undefined
    );
    expect(() =>
      createAgentAuthProtocolErrorResponse({
        error: "invalid_request",
        message: "Invalid",
        extensions: { error: "internal_error" },
      })
    ).toThrow(/must not override/);
  });

  it("parses forward-compatible snake_case errors", () => {
    assert.deepEqual(
      parseAgentAuthProtocolErrorResponse({
        error: "future_extension",
        message: "A future server error",
        retry_after: 5,
      }),
      {
        error: "future_extension",
        message: "A future server error",
        retry_after: 5,
      }
    );
    expect(() =>
      parseAgentAuthProtocolErrorResponse({
        error: "futureExtension",
        message: "Invalid code",
      })
    ).toThrow(/snake_case/);
  });
});
