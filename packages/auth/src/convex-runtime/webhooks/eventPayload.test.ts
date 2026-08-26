import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { buildConvexWebhookPayload, createConvexWebhookEventId } from "./eventPayload";

describe("webhook event payload helpers", () => {
  it("creates stable event ids when injected with deterministic inputs", () => {
    assert.equal(
      createConvexWebhookEventId("evt", 1_700_000_000_000, () => 0.5),
      "evt_1700000000000_i",
    );
  });

  it("builds the canonical webhook payload shape", () => {
    assert.equal(
      buildConvexWebhookPayload({
        id: "evt_1",
        type: "organization.member.added",
        apiVersion: "2026-01-01",
        createdAt: 1_700_000_000_000,
        organizationId: "org_1",
        data: { test: true },
      }),
      JSON.stringify({
        api_version: "2026-01-01",
        created_at: "2023-11-14T22:13:20.000Z",
        data: { test: true },
        id: "evt_1",
        organization_id: "org_1",
        type: "organization.member.added",
      }),
    );
  });
});
