import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  WEBHOOK_EVENT_TYPES,
  isConvexWebhookEventType,
  convexWebhookEndpointSubscribesTo,
} from "./eventCatalog";

describe("webhook event catalog", () => {
  it("exposes the canonical auth-domain event types", () => {
    assert.deepEqual(
      [...WEBHOOK_EVENT_TYPES],
      [
        "user.created",
        "user.updated",
        "user.deleted",
        "organization.created",
        "organization.updated",
        "organization.deleted",
        "member.added",
        "member.removed",
        "member.role_changed",
        "invitation.created",
        "invitation.accepted",
        "invitation.revoked",
      ],
    );
  });

  it("recognizes catalog members and rejects others", () => {
    assert.equal(isConvexWebhookEventType("user.created"), true);
    assert.equal(isConvexWebhookEventType("member.role_changed"), true);
    assert.equal(isConvexWebhookEventType("person.created"), false);
    assert.equal(isConvexWebhookEventType("*"), false);
    assert.equal(isConvexWebhookEventType(""), false);
  });

  it("matches endpoints by explicit subscription", () => {
    assert.equal(
      convexWebhookEndpointSubscribesTo(["user.created", "user.updated"], "user.created"),
      true,
    );
    assert.equal(convexWebhookEndpointSubscribesTo(["user.updated"], "user.created"), false);
  });

  it("matches endpoints subscribed to the wildcard", () => {
    assert.equal(convexWebhookEndpointSubscribesTo(["*"], "organization.created"), true);
  });

  it("matches nothing for an empty subscription list", () => {
    assert.equal(convexWebhookEndpointSubscribesTo([], "user.created"), false);
  });
});
