import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { requireActiveApiKeyRecord } from "./requireActiveApiKeyRecord";

describe("requireActiveApiKeyRecord", () => {
  it("allows active non-expired key", () => {
    assert.doesNotThrow(() =>
      requireActiveApiKeyRecord(
        {
          status: "active",
          expiresAt: Date.now() + 60_000,
        },
        Date.now(),
      ),
    );
  });

  it("rejects revoked key", () => {
    assert.throws(
      () =>
        requireActiveApiKeyRecord({
          status: "revoked",
          expiresAt: null,
        }),
      /API key is not active: revoked/,
    );
  });

  it("rejects expired key", () => {
    assert.throws(
      () =>
        requireActiveApiKeyRecord(
          {
            status: "active",
            expiresAt: 100,
          },
          100,
        ),
      /API key is not active: expired/,
    );
  });

  it("rejects key past idle timeout using last use time", () => {
    assert.throws(
      () =>
        requireActiveApiKeyRecord(
          {
            status: "active",
            expiresAt: null,
            createdAt: 0,
            lastUsedAt: 100,
            maxIdleMs: 50,
          },
          150,
        ),
      /API key is not active: idle_timeout/,
    );
  });

  it("uses creation time when key has never been used", () => {
    assert.throws(
      () =>
        requireActiveApiKeyRecord(
          {
            status: "active",
            expiresAt: null,
            createdAt: 100,
            lastUsedAt: null,
            maxIdleMs: 50,
          },
          150,
        ),
      /API key is not active: idle_timeout/,
    );
  });

  it("allows active key inside idle timeout window", () => {
    assert.doesNotThrow(() =>
      requireActiveApiKeyRecord(
        {
          status: "active",
          expiresAt: null,
          createdAt: 100,
          lastUsedAt: 140,
          maxIdleMs: 50,
        },
        150,
      ),
    );
  });
});
