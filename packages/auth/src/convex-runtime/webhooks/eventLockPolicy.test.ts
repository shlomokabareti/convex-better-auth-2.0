import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { decideConvexWebhookEventLock } from "./eventLockPolicy";

describe("webhook event lock policy", () => {
  it("claims missing events", () => {
    assert.deepEqual(
      decideConvexWebhookEventLock({
        existing: null,
        now: 10_000,
      }),
      { action: "insert", alreadyProcessed: false, alreadyProcessing: false }
    );
  });

  it("reports already processed events", () => {
    assert.deepEqual(
      decideConvexWebhookEventLock({
        existing: { status: "processed", claimedAt: 1 },
        now: 10_000,
      }),
      { action: "processed", alreadyProcessed: true, alreadyProcessing: false }
    );
  });

  it("reports fresh pending claims as inflight", () => {
    assert.deepEqual(
      decideConvexWebhookEventLock({
        existing: { status: "pending", claimedAt: 9_000 },
        now: 10_000,
      }),
      { action: "inflight", alreadyProcessed: false, alreadyProcessing: true }
    );
  });

  it("reclaims stale pending claims", () => {
    assert.deepEqual(
      decideConvexWebhookEventLock({
        existing: { status: "pending", claimedAt: 1_000 },
        staleClaimMs: 5_000,
        now: 10_000,
      }),
      { action: "reclaim", alreadyProcessed: false, alreadyProcessing: false }
    );
  });
});
