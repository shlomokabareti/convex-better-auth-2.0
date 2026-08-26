import assert from "node:assert/strict";

import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
} from "jose";
import { describe, expect, it } from "vitest";

import {
  AGENT_AUTH_PROTOCOL_MAX_CLOCK_SKEW_SECONDS,
  AGENT_AUTH_PROTOCOL_MAX_JWT_LIFETIME_SECONDS,
  verifyAgentAuthProtocolAgentJwt,
  verifyAgentAuthProtocolHostJwt,
} from "./verify";

const NOW = Date.UTC(2026, 6, 30, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW / 1000);
const ISSUER = "https://auth.convex.nyc";
const EXECUTE_AUDIENCE = `${ISSUER}/capability/execute`;

describe("Agent Auth Protocol host JWT verification", () => {
  it("verifies Ed25519, RFC 7638 issuer, exact audience, and replay window", async () => {
    const host = await createSigningKey();
    const agent = await createSigningKey();
    const token = await signHostJwt(host, agent.publicJwk);

    const verified = await verifyAgentAuthProtocolHostJwt({
      token,
      expectedAudience: ISSUER,
      registration: true,
      options: { now: NOW },
    });

    assert.equal(verified.signingKeyThumbprint, host.thumbprint);
    assert.equal(verified.claims.iss, host.thumbprint);
    assert.equal(
      verified.replayExpiresAt,
      (NOW_SECONDS +
        AGENT_AUTH_PROTOCOL_MAX_JWT_LIFETIME_SECONDS +
        AGENT_AUTH_PROTOCOL_MAX_CLOCK_SKEW_SECONDS) *
        1000
    );
  });

  it("verifies a resolved JWKS key and pins its kid", async () => {
    const host = await createSigningKey("host-key-1");
    const agent = await createSigningKey();
    const token = await signHostJwt(host, agent.publicJwk, {
      hostJwksUrl: "https://runtime.example/host-jwks.json",
    });

    const verified = await verifyAgentAuthProtocolHostJwt({
      token,
      expectedAudience: ISSUER,
      expectedKeyId: "host-key-1",
      registration: true,
      resolvedPublicKey: host.publicJwk,
      options: { now: NOW },
    });

    assert.equal(verified.header.kid, "host-key-1");
  });

  it("rejects forged signatures, thumbprints, audiences, and token types", async () => {
    const host = await createSigningKey();
    const attacker = await createSigningKey();
    const agent = await createSigningKey();
    const validClaims = {
      iss: host.thumbprint,
      aud: ISSUER,
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 60,
      jti: "host-jti",
      host_public_key: host.publicJwk,
      agent_public_key: agent.publicJwk,
    };
    const forged = await new SignJWT(validClaims)
      .setProtectedHeader({ alg: "EdDSA", typ: "host+jwt" })
      .sign(attacker.privateKey);
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: forged,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow();

    const wrongThumbprint = await signHostJwt(host, agent.publicJwk, {
      issuer: "wrong-thumbprint",
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: wrongThumbprint,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/thumbprint/);

    const wrongAudience = await signHostJwt(host, agent.publicJwk, {
      audience: `${ISSUER}/other`,
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: wrongAudience,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/audience/);

    const confusedType = await signHostJwt(host, agent.publicJwk, {
      typ: "agent+jwt",
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: confusedType,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/host\+jwt/);
  });

  it("rejects excessive lifetimes and future-issued tokens beyond skew", async () => {
    const host = await createSigningKey();
    const agent = await createSigningKey();
    const excessiveLifetime = await signHostJwt(host, agent.publicJwk, {
      expiresAt: NOW_SECONDS + 61,
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: excessiveLifetime,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/lifetime/);

    const future = await signHostJwt(host, agent.publicJwk, {
      issuedAt: NOW_SECONDS + 31,
      expiresAt: NOW_SECONDS + 60,
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: future,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/future/);

    const expiredBeyondSkew = await signHostJwt(host, agent.publicJwk, {
      issuedAt: NOW_SECONDS - 91,
      expiresAt: NOW_SECONDS - 31,
    });
    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: expiredBeyondSkew,
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW },
      })
    ).rejects.toThrow(/exp|expired/i);

    await expect(
      verifyAgentAuthProtocolHostJwt({
        token: await signHostJwt(host, agent.publicJwk),
        expectedAudience: ISSUER,
        registration: true,
        options: { now: NOW, clockSkewSeconds: 31 },
      })
    ).rejects.toThrow(/between 0 and 30/);
  });
});

describe("Agent Auth Protocol agent JWT verification", () => {
  it("verifies the stored agent key and preserves optional capability narrowing", async () => {
    const host = await createSigningKey();
    const agent = await createSigningKey();
    const token = await signAgentJwt(agent, host.thumbprint, {
      capabilities: ["sentry:investigate"],
    });

    const verified = await verifyAgentAuthProtocolAgentJwt({
      token,
      expectedAudience: EXECUTE_AUDIENCE,
      expectedHostThumbprint: host.thumbprint,
      expectedAgentId: "agent-1",
      publicKey: agent.publicJwk,
      options: { now: NOW },
    });

    assert.deepEqual(verified.claims.capabilities, ["sentry:investigate"]);
    assert.equal(
      verified.replayExpiresAt,
      (NOW_SECONDS + 90) * 1000,
      "replay retention covers the lifetime plus accepted clock skew"
    );
  });

  it("accepts an omitted capability claim as no credential-level narrowing", async () => {
    const host = await createSigningKey();
    const agent = await createSigningKey();
    const verified = await verifyAgentAuthProtocolAgentJwt({
      token: await signAgentJwt(agent, host.thumbprint),
      expectedAudience: EXECUTE_AUDIENCE,
      expectedHostThumbprint: host.thumbprint,
      expectedAgentId: "agent-1",
      publicKey: agent.publicJwk,
      options: { now: NOW },
    });

    assert.equal(verified.claims.capabilities, undefined);
  });

  it("rejects signature, host, subject, audience, and key-id confusion", async () => {
    const host = await createSigningKey();
    const agent = await createSigningKey("agent-key-1");
    const attacker = await createSigningKey();

    await expect(
      verifyAgentAuthProtocolAgentJwt({
        token: await signAgentJwt(attacker, host.thumbprint),
        expectedAudience: EXECUTE_AUDIENCE,
        expectedHostThumbprint: host.thumbprint,
        expectedAgentId: "agent-1",
        publicKey: agent.publicJwk,
        options: { now: NOW },
      })
    ).rejects.toThrow();

    for (const [token, overrides, expected] of [
      [
        await signAgentJwt(agent, "wrong-host"),
        {},
        /issuer does not match its host/,
      ],
      [
        await signAgentJwt(agent, host.thumbprint, { subject: "agent-2" }),
        {},
        /subject/,
      ],
      [
        await signAgentJwt(agent, host.thumbprint, {
          audience: `${ISSUER}/other`,
        }),
        {},
        /audience/,
      ],
      [
        await signAgentJwt(agent, host.thumbprint),
        { expectedKeyId: "agent-key-2" },
        /key id/,
      ],
    ] as const) {
      await expect(
        verifyAgentAuthProtocolAgentJwt({
          token,
          expectedAudience: EXECUTE_AUDIENCE,
          expectedHostThumbprint: host.thumbprint,
          expectedAgentId: "agent-1",
          publicKey: agent.publicJwk,
          options: { now: NOW },
          ...overrides,
        })
      ).rejects.toThrow(expected);
    }
  });
});

type SigningKey = {
  publicJwk: JWK;
  privateKey: CryptoKey;
  thumbprint: string;
};

async function createSigningKey(kid?: string): Promise<SigningKey> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const exported = await exportJWK(publicKey);
  const publicJwk = {
    ...exported,
    ...(kid === undefined ? {} : { kid }),
  };
  return {
    publicJwk,
    privateKey,
    thumbprint: await calculateJwkThumbprint(exported, "sha256"),
  };
}

async function signHostJwt(
  host: SigningKey,
  agentPublicJwk: JWK,
  overrides?: {
    audience?: string;
    expiresAt?: number;
    hostJwksUrl?: string;
    issuedAt?: number;
    issuer?: string;
    typ?: string;
  }
): Promise<string> {
  const issuedAt = overrides?.issuedAt ?? NOW_SECONDS;
  const claims = {
    iss: overrides?.issuer ?? host.thumbprint,
    aud: overrides?.audience ?? ISSUER,
    iat: issuedAt,
    exp: overrides?.expiresAt ?? issuedAt + 60,
    jti: crypto.randomUUID(),
    ...(overrides?.hostJwksUrl === undefined
      ? { host_public_key: host.publicJwk }
      : { host_jwks_url: overrides.hostJwksUrl }),
    agent_public_key: agentPublicJwk,
  };
  return await new SignJWT(claims)
    .setProtectedHeader({
      alg: "EdDSA",
      typ: overrides?.typ ?? "host+jwt",
      ...(host.publicJwk.kid === undefined ? {} : { kid: host.publicJwk.kid }),
    })
    .sign(host.privateKey);
}

async function signAgentJwt(
  agent: SigningKey,
  hostThumbprint: string,
  overrides?: {
    audience?: string;
    capabilities?: string[];
    subject?: string;
  }
): Promise<string> {
  return await new SignJWT({
    iss: hostThumbprint,
    sub: overrides?.subject ?? "agent-1",
    aud: overrides?.audience ?? EXECUTE_AUDIENCE,
    iat: NOW_SECONDS,
    exp: NOW_SECONDS + 60,
    jti: crypto.randomUUID(),
    ...(overrides?.capabilities === undefined
      ? {}
      : { capabilities: overrides.capabilities }),
  })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "agent+jwt",
      ...(agent.publicJwk.kid === undefined
        ? {}
        : { kid: agent.publicJwk.kid }),
    })
    .sign(agent.privateKey);
}
