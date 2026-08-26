import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  createAgentAuthDeviceAuthorizationChallenge,
  hashAgentAuthDeviceAuthorizationCode,
  normalizeAgentAuthUserCode,
} from "./device-authorization";

describe("Agent Auth RFC 8628 device authorization", () => {
  it("creates high-entropy bearer codes and stores only deterministic hashes", async () => {
    let seed = 0;
    const challenge = await createAgentAuthDeviceAuthorizationChallenge({
      now: 1_000,
      randomBytes: (length) =>
        Uint8Array.from({ length }, () => {
          seed = (seed + 17) % 240;
          return seed;
        }),
    });

    assert.match(
      challenge.userCode,
      /^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/u
    );
    assert.match(challenge.deviceCode, /^[A-Za-z0-9_-]{43}$/u);
    assert.match(challenge.userCodeHash, /^[A-Za-z0-9_-]{43}$/u);
    assert.match(challenge.deviceCodeHash, /^[A-Za-z0-9_-]{43}$/u);
    assert.equal(challenge.expiresAt, 601_000);
    assert.equal(challenge.interval, 5);
    assert.notEqual(challenge.deviceCodeHash, challenge.deviceCode);
    assert.notEqual(challenge.userCodeHash, challenge.userCode);
  });

  it("normalizes human-readable codes before hashing", async () => {
    const normalized = normalizeAgentAuthUserCode("bcdf-ghjk");
    assert.equal(normalized, "BCDFGHJK");
    assert.equal(
      await hashAgentAuthDeviceAuthorizationCode(normalized),
      await hashAgentAuthDeviceAuthorizationCode(
        normalizeAgentAuthUserCode("BCDF GHJK")
      )
    );
  });

  it("rejects invalid code characters and unsafe policy bounds", async () => {
    assert.throws(
      () => normalizeAgentAuthUserCode("AAAA-AAAA"),
      /user code is invalid/
    );
    await assert.rejects(
      createAgentAuthDeviceAuthorizationChallenge({ expiresIn: 901 }),
      /expiresIn must be/
    );
    await assert.rejects(
      createAgentAuthDeviceAuthorizationChallenge({ interval: 61 }),
      /interval must be/
    );
  });
});
