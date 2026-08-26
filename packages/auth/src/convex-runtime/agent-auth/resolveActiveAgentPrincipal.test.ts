import assert from "node:assert/strict";

import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, it } from "vitest";

import type {
  AgentCredentialAuthorityAdapter,
  AgentCredentialAuthorityResult,
  AgentRequestBinding,
} from "./resolveActiveAgentPrincipal";
import { resolveActiveAgentPrincipal } from "./resolveActiveAgentPrincipal";

const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);
const AUDIENCE = "https://chat.example.com/agent";

describe("resolveActiveAgentPrincipal", () => {
  it("verifies Ed25519, request binding, authority intersection, and replay", async () => {
    const fixture = await createFixture();
    const token = await fixture.sign();
    const principal = await resolveActiveAgentPrincipal(fixture.adapter, {
      token,
      audience: AUDIENCE,
      requestBinding: fixture.binding,
      now: NOW,
    });

    assert.equal(principal.kind, "agent");
    assert.equal(principal.mode, "delegated");
    assert.equal(principal.delegatedUserId, "user-1");
    assert.deepEqual(principal.permissions, ["agents:invoke"]);
    assert.deepEqual(principal.capabilityGrants, [
      {
        capability: "sentry:investigate",
        constraints: { severity: { in: ["error", "fatal"] } },
        expiresAt: NOW + 60_000,
      },
    ]);

    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token,
        audience: AUDIENCE,
        requestBinding: fixture.binding,
        now: NOW,
      }),
      /replayed/,
    );
  });

  it("rejects signature, audience, and request-binding confusion", async () => {
    const fixture = await createFixture();
    const attacker = await createFixture();
    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: await attacker.sign(),
        audience: AUDIENCE,
        requestBinding: fixture.binding,
        now: NOW,
      }),
      /signature verification failed|verification signature failed/i,
    );

    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: await fixture.sign({ jti: "wrong-audience" }),
        audience: "https://other.example.com",
        requestBinding: fixture.binding,
        now: NOW,
      }),
      /aud/i,
    );

    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: await fixture.sign({ jti: "wrong-binding" }),
        audience: AUDIENCE,
        requestBinding: { ...fixture.binding, method: "DELETE" },
        now: NOW,
      }),
      /request binding/,
    );

    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: await fixture.sign({
          jti: "future-issued-at",
          issuedAt: Math.floor(NOW / 1000) + 60,
        }),
        audience: AUDIENCE,
        requestBinding: fixture.binding,
        now: NOW,
      }),
      /issued-at/,
    );
  });

  it("rejects authority responses that substitute organization or actor", async () => {
    const fixture = await createFixture({
      authority: { organizationId: "org-attacker" },
    });
    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: await fixture.sign(),
        audience: AUDIENCE,
        requestBinding: fixture.binding,
        now: NOW,
      }),
      /does not match verified key/,
    );
  });

  it("rejects confused identity, type, expiry, and oversized lifetimes", async () => {
    const fixture = await createFixture();
    const wrongAlgorithm = await new SignJWT({})
      .setProtectedHeader({
        alg: "HS256",
        typ: "JWT",
        kid: "key-thumbprint",
      })
      .sign(new TextEncoder().encode("not-an-ed25519-key"));
    await assert.rejects(
      resolveActiveAgentPrincipal(fixture.adapter, {
        token: wrongAlgorithm,
        audience: AUDIENCE,
        now: NOW,
      }),
      /algorithm or type is invalid/,
    );
    for (const [token, expected] of [
      [await fixture.sign({ issuer: "wrong-issuer" }), /iss/i],
      [await fixture.sign({ subject: "wrong-agent" }), /sub/i],
      [await fixture.sign({ typ: "NOT-JWT" }), /type is invalid/],
      [
        await fixture.sign({
          issuedAt: Math.floor(NOW / 1000) - 120,
          expiresAt: Math.floor(NOW / 1000) - 60,
        }),
        /exp|expired/i,
      ],
      [
        await fixture.sign({
          expiresAt: Math.floor(NOW / 1000) + 91,
        }),
        /lifetime is invalid/,
      ],
    ] as const) {
      await assert.rejects(
        resolveActiveAgentPrincipal(fixture.adapter, {
          token,
          audience: AUDIENCE,
          requestBinding: fixture.binding,
          now: NOW,
        }),
        expected,
      );
    }
  });
});

async function createFixture(overrides?: { authority?: Partial<AgentCredentialAuthorityResult> }) {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const publicJwk = await exportJWK(publicKey);
  const thumbprint = "key-thumbprint";
  const binding: AgentRequestBinding = {
    method: "POST",
    url: AUDIENCE,
    bodySha256: "body-digest",
  };
  const consumed = new Set<string>();
  const authority: AgentCredentialAuthorityResult = {
    kind: "agent",
    agentId: "agent-1",
    hostId: "host-1",
    organizationId: "org-1",
    mode: "delegated",
    delegatedUserId: "user-1",
    credentialId: "agent-1:1",
    permissions: ["agents:invoke"],
    capabilityGrants: [
      {
        capability: "sentry:investigate",
        constraintsJson: JSON.stringify({
          severity: { in: ["error", "fatal"] },
        }),
        expiresAt: NOW + 60_000,
      },
    ],
    isRestricted: false,
    restrictedReason: null,
    ...overrides?.authority,
  };
  const adapter: AgentCredentialAuthorityAdapter = {
    async getVerificationMaterial() {
      return {
        agentId: "agent-1",
        hostId: "host-1",
        organizationId: "org-1",
        generation: 1,
        thumbprint,
        publicJwkJson: JSON.stringify(publicJwk),
      };
    },
    async consumeCredential(input) {
      if (consumed.has(input.replayIdHash)) {
        throw new Error("Agent credential replayed");
      }
      consumed.add(input.replayIdHash);
      return authority;
    },
  };

  return {
    adapter,
    binding,
    async sign(input?: {
      jti?: string;
      issuedAt?: number;
      expiresAt?: number;
      issuer?: string;
      subject?: string;
      typ?: string;
    }) {
      const nowSeconds = Math.floor(NOW / 1000);
      const issuedAt = input?.issuedAt ?? nowSeconds;
      const expiresAt = input?.expiresAt ?? issuedAt + 60;
      return await new SignJWT({
        permissions: ["agents:invoke", "agents:configure"],
        capabilities: ["sentry:investigate", "posthog:measure"],
        htm: binding.method,
        htu: binding.url,
        body_sha256: binding.bodySha256,
      })
        .setProtectedHeader({
          alg: "EdDSA",
          typ: input?.typ ?? "JWT",
          kid: thumbprint,
        })
        .setIssuer(input?.issuer ?? thumbprint)
        .setSubject(input?.subject ?? "agent-1")
        .setAudience(AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAt)
        .setJti(input?.jti ?? crypto.randomUUID())
        .sign(privateKey);
    },
  };
}
