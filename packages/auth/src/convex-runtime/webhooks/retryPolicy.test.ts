import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  getConvexWebhookExponentialBackoffMs,
  getConvexWebhookJitteredBackoffMs,
  getConvexWebhookRetryAt,
} from "./retryPolicy";

describe("webhook retry policy", () => {
  it("grows exponentially and caps backoff", () => {
    assert.equal(getConvexWebhookExponentialBackoffMs(1), 30_000);
    assert.equal(getConvexWebhookExponentialBackoffMs(2), 60_000);
    assert.equal(getConvexWebhookExponentialBackoffMs(3), 120_000);
    assert.equal(getConvexWebhookExponentialBackoffMs(10), 15 * 60 * 1000);
  });

  it("adds deterministic jitter per delivery key", () => {
    const first = getConvexWebhookJitteredBackoffMs(2, "delivery-a");
    const second = getConvexWebhookJitteredBackoffMs(2, "delivery-a");
    const third = getConvexWebhookJitteredBackoffMs(2, "delivery-b");

    assert.equal(first, second);
    assert.ok(first >= 60_000);
    assert.ok(first <= 72_000);
    assert.notEqual(third, first);
  });

  it("computes retry-at from now plus jittered backoff", () => {
    const now = 1_000_000;
    const retryAt = getConvexWebhookRetryAt({
      attemptCount: 1,
      now,
      deliveryKey: "delivery-a",
    });

    assert.ok(retryAt >= now + 30_000);
    assert.ok(retryAt <= now + 36_000);
  });
});
