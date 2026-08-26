import assert from "node:assert/strict";

import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { describe, it } from "vitest";

import {
  AGENT_AUTH_PROTOCOL_V1_ENDPOINTS,
  agentAuthProtocolHttpRoutes,
  createAgentAuthProtocolHttpServer,
  type CreateAgentAuthProtocolHttpServerConfig,
} from "./agent-auth-protocol-http";

describe("Agent Auth Protocol HTTP server", () => {
  it("mounts the complete profile and serves cacheable discovery", async () => {
    const fixture = await createFixture();
    const routes = agentAuthProtocolHttpRoutes();
    assert.equal(routes.length, 13);
    assert.equal(routes.filter((route) => route.method === "GET").length, 4);
    assert.equal(routes.filter((route) => route.method === "POST").length, 9);
    assert.equal(
      new Set(routes.map((route) => route.path)).size,
      routes.length
    );
    const mounted: (typeof routes)[number][] = [];
    fixture.server.registerHttpRoutes(
      { route: (route) => mounted.push(route) },
      Symbol("handler")
    );
    assert.deepEqual(
      mounted.map(({ path, method }) => ({ path, method })),
      routes
    );

    const response = await fixture.server.handleHttpRequest(
      undefined,
      new Request("https://auth.example.com/.well-known/agent-configuration")
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
    const discovery: unknown = await response.json();
    assert.ok(isRecord(discovery));
    assert.deepEqual(discovery.endpoints, AGENT_AUTH_PROTOCOL_V1_ENDPOINTS);
  });

  it("registers through a known host and returns each raw device code once", async () => {
    const fixture = await createFixture();
    const token = await fixture.signHost(
      AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.register,
      true,
      "register-once"
    );
    const response = await fixture.server.handleHttpRequest(
      undefined,
      protocolRequest(AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.register, {
        token,
        body: {
          organization_id: "org-1",
          name: "Sentry investigator",
          mode: "autonomous",
          permissions: ["errors:read"],
          capabilities: [{ name: "sentry:investigate" }],
        },
      })
    );
    assert.equal(response.status, 201);
    const body: unknown = await response.json();
    assert.ok(isRecord(body));
    assert.ok(isRecord(body.approval));
    const agentId = requireString(body.agent_id);
    const userCode = requireString(body.approval.user_code);
    const deviceCode = requireString(body.approval.device_code);
    const verificationUriComplete = requireString(
      body.approval.verification_uri_complete
    );
    assert.equal(agentId, "agent-1");
    assert.match(userCode, /^[A-Z]{4}-[A-Z]{4}$/u);
    assert.ok(deviceCode.length >= 40);
    assert.match(verificationUriComplete, /user_code=/u);
    assert.equal(fixture.registrations.length, 1);
    assert.ok(!JSON.stringify(fixture.registrations[0]).includes(deviceCode));

    const replay = await fixture.server.handleHttpRequest(
      undefined,
      protocolRequest(AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.register, {
        token,
        body: {
          organization_id: "org-1",
          name: "Replay",
          mode: "autonomous",
          permissions: [],
          capabilities: [],
        },
      })
    );
    assert.equal(replay.status, 401);
  });

  it("passes a narrowed live agent principal to product execution", async () => {
    const fixture = await createFixture();
    const token = await fixture.signAgent(
      AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute,
      "execute-once"
    );
    const response = await fixture.server.handleHttpRequest(
      undefined,
      protocolRequest(AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute, {
        token,
        body: {
          organization_id: "org-1",
          capability: "sentry:investigate",
          arguments: { issue: "SENTRY-1" },
        },
      })
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      accepted: true,
      agent_id: "agent-1",
      capability: "sentry:investigate",
    });
    assert.equal(fixture.executions.length, 1);
    assert.deepEqual(fixture.executions[0]?.principal.permissions, [
      "errors:read",
    ]);
  });

  it("rejects missing version headers before authentication", async () => {
    const fixture = await createFixture();
    const response = await fixture.server.handleHttpRequest(
      undefined,
      new Request(
        `https://auth.example.com${AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.execute}`,
        { method: "POST" }
      )
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "invalid_request",
      message: "agent-auth-version must be 1.0-draft",
    });
  });

  it("rejects a host requesting another organization's authority", async () => {
    const fixture = await createFixture();
    const token = await fixture.signHost(
      AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.status,
      false,
      "cross-organization"
    );
    const url = new URL(
      AGENT_AUTH_PROTOCOL_V1_ENDPOINTS.status,
      "https://auth.example.com"
    );
    url.searchParams.set("organization_id", "org-2");
    url.searchParams.set("agent_id", "agent-1");
    const response = await fixture.server.handleHttpRequest(
      undefined,
      new Request(url, {
        headers: {
          authorization: `Bearer ${token}`,
          "agent-auth-version": "1.0-draft",
        },
      })
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "unauthorized",
      message: "Agent host organization mismatch",
    });
  });
});

async function createFixture() {
  const hostKeys = await generateKeyPair("EdDSA");
  const agentKeys = await generateKeyPair("EdDSA");
  const hostJwk = await exportJWK(hostKeys.publicKey);
  const agentJwk = await exportJWK(agentKeys.publicKey);
  const hostThumbprint = await calculateJwkThumbprint(hostJwk, "sha256");
  const hostReplays = new Set<string>();
  const agentReplays = new Set<string>();
  const registrations: unknown[] = [];
  const executions: Array<{ principal: { permissions: string[] } }> = [];

  const config = {
    issuer: "https://auth.example.com",
    providerName: "Convex",
    description: "Convex Agent Auth",
    verificationUri: "https://auth.example.com/agent/approve",
    authority: {
      host: () => ({
        getVerificationMaterial: async () => ({
          hostId: "host-1",
          organizationId: "org-1",
          generation: 1,
          thumbprint: hostThumbprint,
          publicJwkJson: JSON.stringify(hostJwk),
        }),
        consumeRequest: async (input) => {
          if (hostReplays.has(input.replayIdHash))
            throw new Error("Agent host request replayed");
          hostReplays.add(input.replayIdHash);
          if (
            input.requestedOrganizationId !== undefined &&
            input.requestedOrganizationId !== "org-1"
          )
            throw new Error("Agent host organization mismatch");
          return {
            hostId: "host-1",
            organizationId: "org-1",
            keyGeneration: 1,
          };
        },
      }),
      agent: () => ({
        getVerificationMaterial: async () => ({
          agentId: "agent-1",
          hostId: "host-1",
          organizationId: "org-1",
          agentKeyGeneration: 1,
          agentPublicJwkJson: JSON.stringify(agentJwk),
          hostKeyGeneration: 1,
          hostThumbprint,
        }),
        consumeCredential: async (input) => {
          if (agentReplays.has(input.replayIdHash))
            throw new Error("Agent credential replayed");
          agentReplays.add(input.replayIdHash);
          return {
            kind: "agent" as const,
            agentId: "agent-1",
            hostId: "host-1",
            organizationId: "org-1",
            mode: "autonomous" as const,
            delegatedUserId: null,
            credentialId: "agent-1:1",
            permissions: ["errors:read"],
            capabilityGrants: [{ capability: "sentry:investigate" }],
            isRestricted: false,
            restrictedReason: null,
          };
        },
      }),
      async registerAgent(_ctx, input) {
        registrations.push(input);
        return { agentId: "agent-1", authorizationId: "approval-1" };
      },
      async pollDeviceAuthorization() {
        return { status: "authorization_pending", interval: 5 };
      },
      async getAgentStatus() {
        return {
          agentId: "agent-1",
          hostId: "host-1",
          organizationId: "org-1",
          status: "active",
        };
      },
      async reactivateAgent() {
        return { status: "active" };
      },
      async revokeAgent() {
        return { ok: true };
      },
      async revokeHost() {
        return { ok: true };
      },
      async rotateAgentKey() {
        return { generation: 2 };
      },
      async rotateHostKey() {
        return { generation: 2 };
      },
      async introspectAgent() {
        return { active: true, agentId: "agent-1" };
      },
    },
    capabilities: {
      async list() {
        return { capabilities: [] };
      },
      async describe(_ctx, input) {
        return { name: input.capability };
      },
      async request() {
        return { status: "pending" };
      },
      async execute(_ctx, input) {
        executions.push({ principal: input.principal });
        return {
          accepted: true,
          agent_id: input.principal.agentId,
          capability: input.capability,
        };
      },
    },
  } satisfies CreateAgentAuthProtocolHttpServerConfig<undefined>;
  const server = createAgentAuthProtocolHttpServer(config);
  const signHost = async (path: string, registration: boolean, jti: string) => {
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({
      host_public_key: hostJwk,
      ...(registration ? { agent_public_key: agentJwk } : {}),
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "host+jwt" })
      .setIssuer(hostThumbprint)
      .setAudience(`https://auth.example.com${path}`)
      .setIssuedAt(now)
      .setExpirationTime(now + 30)
      .setJti(jti)
      .sign(hostKeys.privateKey);
  };
  const signAgent = async (path: string, jti: string) => {
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({ capabilities: ["sentry:investigate"] })
      .setProtectedHeader({ alg: "EdDSA", typ: "agent+jwt" })
      .setIssuer(hostThumbprint)
      .setSubject("agent-1")
      .setAudience(`https://auth.example.com${path}`)
      .setIssuedAt(now)
      .setExpirationTime(now + 30)
      .setJti(jti)
      .sign(agentKeys.privateKey);
  };
  return {
    server,
    registrations,
    executions,
    signHost,
    signAgent,
  };
}

function protocolRequest(
  path: string,
  input: { token: string; body: Record<string, unknown> }
): Request {
  return new Request(`https://auth.example.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "agent-auth-version": "1.0-draft",
      "content-type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown): string {
  assert.equal(typeof value, "string");
  if (typeof value !== "string") throw new TypeError("Expected a string");
  return value;
}
