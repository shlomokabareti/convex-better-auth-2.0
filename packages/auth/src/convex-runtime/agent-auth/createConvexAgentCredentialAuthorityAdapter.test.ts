import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { createConvexAgentCredentialAuthorityAdapter } from "./createConvexAgentCredentialAuthorityAdapter";

describe("createConvexAgentCredentialAuthorityAdapter", () => {
  it("routes verification and atomic consumption through the supplied refs", async () => {
    const verificationRef = Symbol("verification");
    const consumptionRef = Symbol("consumption");
    const material = {
      agentId: "agent-1",
      hostId: "host-1",
      organizationId: "org-1",
      generation: 2,
      thumbprint: "thumbprint-1",
      publicJwkJson: '{"kty":"OKP","crv":"Ed25519","x":"public"}',
    };
    const authority = {
      kind: "agent" as const,
      agentId: "agent-1",
      hostId: "host-1",
      organizationId: "org-1",
      mode: "autonomous" as const,
      delegatedUserId: null,
      credentialId: "agent-1:2",
      permissions: ["agents:invoke"],
      capabilityGrants: [],
      isRestricted: false,
      restrictedReason: null,
    };
    const runQuery = vi.fn(async () => material);
    const runMutation = vi.fn(async () => authority);
    const adapter = createConvexAgentCredentialAuthorityAdapter({
      runQuery,
      runMutation,
      refs: {
        getAgentVerificationMaterial: verificationRef,
        consumeAgentCredential: consumptionRef,
      },
    });

    assert.deepEqual(
      await adapter.getVerificationMaterial({ thumbprint: "thumbprint-1" }),
      material
    );
    const consumeInput = {
      agentId: "agent-1",
      keyGeneration: 2,
      replayIdHash: "replay-hash",
      replayExpiresAt: 1_785_436_860_000,
      requestedOrganizationId: "org-1",
      claimedPermissions: ["agents:invoke"],
      claimedCapabilities: ["sentry:investigate"],
    };
    assert.deepEqual(await adapter.consumeCredential(consumeInput), authority);
    assert.deepEqual(runQuery.mock.calls, [
      [verificationRef, { thumbprint: "thumbprint-1" }],
    ]);
    assert.deepEqual(runMutation.mock.calls, [[consumptionRef, consumeInput]]);
  });
});
