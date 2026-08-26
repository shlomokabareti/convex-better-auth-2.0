import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  buildPasswordResetUrl,
  createPasswordResetEmailDraft,
  createPasswordResetEmailEventPatch,
  createPasswordResetEmailFailedPatch,
  createPasswordResetEmailNotConfiguredPatch,
  createPasswordResetEmailQueuedPatch,
  mapResendEventToPasswordResetEmailDelivery,
  resolvePasswordResetFromAddress,
  sendPasswordResetEmail,
} from "./passwordResetEmail";

describe("password reset email helpers", () => {
  it("builds reset URL from template placeholder", () => {
    assert.equal(
      buildPasswordResetUrl({
        token: "token with spaces",
        templateUrl: "https://app.example.com/reset/{token}",
      }),
      "https://app.example.com/reset/token%20with%20spaces",
    );
  });

  it("builds reset URL from app origin with default path", () => {
    assert.equal(
      buildPasswordResetUrl({
        token: "abc123",
        appOrigin: "https://app.example.com/",
      }),
      "https://app.example.com/reset-password?token=abc123",
    );
  });

  it("returns null when neither template nor app origin provided", () => {
    assert.equal(buildPasswordResetUrl({ token: "abc123" }), null);
  });

  it("returns not configured when draft is missing transport settings", async () => {
    assert.deepStrictEqual(
      await createPasswordResetEmailDraft({
        from: null,
        to: "user@example.com",
        resetUrl: "https://app.example.com/reset-password?token=abc",
      }),
      { status: "not_configured", reason: "missing_from_address" },
    );

    assert.deepStrictEqual(
      await createPasswordResetEmailDraft({
        from: "Convex <auth@example.com>",
        to: "user@example.com",
        resetUrl: null,
      }),
      { status: "not_configured", reason: "missing_reset_url" },
    );
  });

  it("renders escaped password reset email content", async () => {
    const draft = await createPasswordResetEmailDraft({
      from: "Convex <auth@example.com>",
      to: "user@example.com",
      resetUrl: "https://app.example.com/reset-password?token=a&b",
      expiresAt: Date.UTC(2026, 0, 1),
    });

    assert.equal("subject" in draft ? draft.subject : null, "Reset your password");
    assert.equal("to" in draft ? draft.to : null, "user@example.com");
    assert.match("html" in draft ? draft.html : "", /token=a&amp;b/);
    assert.match("text" in draft ? draft.text : "", /token=a&b/);
    assert.match("html" in draft ? draft.html : "", /This link expires/);
    assert.match(
      "html" in draft ? draft.html : "",
      /We received a request to reset your password\./,
    );
    assert.match(
      "html" in draft ? draft.html : "",
      /If you did not request this, you can safely ignore this email\./,
    );
    assert.match(
      "text" in draft ? draft.text : "",
      /Reset your password: https:\/\/app\.example\.com\/reset-password\?token=a&b/,
    );
  });

  it("maps Resend delivery events into reset delivery status", () => {
    assert.deepStrictEqual(
      mapResendEventToPasswordResetEmailDelivery({
        event: { type: "email.sent" },
      }),
      { status: "sent", eventType: "email.sent" },
    );

    assert.deepStrictEqual(
      mapResendEventToPasswordResetEmailDelivery({
        event: { type: "email.delivered" },
      }),
      { status: "delivered", eventType: "email.delivered" },
    );

    assert.deepStrictEqual(
      mapResendEventToPasswordResetEmailDelivery({
        event: {
          type: "email.bounced",
          data: { bounce: { message: "Mailbox not found" } },
        },
      }),
      {
        status: "bounced",
        eventType: "email.bounced",
        error: "Mailbox not found",
      },
    );

    assert.deepStrictEqual(
      mapResendEventToPasswordResetEmailDelivery({
        event: { type: "email.failed", data: { failed: { reason: "denied" } } },
      }),
      { status: "failed", eventType: "email.failed", error: "denied" },
    );
  });

  it("creates delivery patches for client Convex mutations", () => {
    assert.deepStrictEqual(createPasswordResetEmailQueuedPatch({ emailId: "email_123", now: 10 }), {
      emailId: "email_123",
      emailDeliveryStatus: "queued",
      emailDeliveryEvent: "queued",
      emailDeliveryError: undefined,
      emailDeliveryUpdatedAt: 10,
    });

    assert.deepStrictEqual(
      createPasswordResetEmailNotConfiguredPatch({
        reason: "missing_reset_url",
        now: 20,
      }),
      {
        emailDeliveryStatus: "not_configured",
        emailDeliveryEvent: "missing_reset_url",
        emailDeliveryError: undefined,
        emailDeliveryUpdatedAt: 20,
      },
    );

    assert.deepStrictEqual(createPasswordResetEmailFailedPatch({ reason: "boom", now: 30 }), {
      emailDeliveryStatus: "failed",
      emailDeliveryEvent: "enqueue_failed",
      emailDeliveryError: "boom",
      emailDeliveryUpdatedAt: 30,
    });

    assert.deepStrictEqual(
      createPasswordResetEmailEventPatch({
        event: { type: "email.failed", data: { failed: { reason: "denied" } } },
        now: 40,
      }),
      {
        emailDeliveryStatus: "failed",
        emailDeliveryEvent: "email.failed",
        emailDeliveryError: "denied",
        emailDeliveryUpdatedAt: 40,
      },
    );
  });

  it("resolves sender from primary or fallback env values", () => {
    assert.equal(
      resolvePasswordResetFromAddress({
        primary: " Convex <auth@example.com> ",
        fallback: "Fallback <fallback@example.com>",
      }),
      "Convex <auth@example.com>",
    );
    assert.equal(
      resolvePasswordResetFromAddress({
        primary: " ",
        fallback: "Fallback <fallback@example.com>",
      }),
      "Fallback <fallback@example.com>",
    );
    assert.equal(resolvePasswordResetFromAddress({ primary: null, fallback: null }), null);
  });

  it("orchestrates send, render, and delivery recording", async () => {
    const events: string[] = [];
    const result = await sendPasswordResetEmail({
      token: "reset-token",
      account: { email: "user@example.com" },
      from: "Convex <auth@example.com>",
      appOrigin: "https://app.example.com",
      renderEmailDraft: async (draft) => {
        events.push(`render:${draft.resetUrl}`);
        return {
          from: draft.from,
          to: draft.to,
          subject: "Reset",
          html: "<p>Reset</p>",
          text: "Reset",
        };
      },
      sendEmail: async (draft) => {
        events.push(`send:${draft.to}`);
        return "email_123";
      },
      recordQueued: async (emailId) => {
        events.push(`queued:${emailId}`);
        return { status: "queued", emailId };
      },
      recordNotConfigured: async (reason) => {
        events.push(`not_configured:${reason}`);
        return { status: "not_configured", reason };
      },
      recordFailed: async (reason) => {
        events.push(`failed:${reason}`);
        return { status: "failed", reason };
      },
    });

    assert.deepStrictEqual(result, { status: "queued", emailId: "email_123" });
    assert.deepStrictEqual(events, [
      "render:https://app.example.com/reset-password?token=reset-token",
      "send:user@example.com",
      "queued:email_123",
    ]);
  });

  it("records missing configuration without sending", async () => {
    const result = await sendPasswordResetEmail({
      token: "reset-token",
      account: { email: "user@example.com" },
      from: null,
      appOrigin: "https://app.example.com",
      sendEmail: async () => {
        throw new Error("send should not run");
      },
      recordQueued: async (emailId) => ({ status: "queued", emailId }),
      recordNotConfigured: async (reason) => ({
        status: "not_configured",
        reason,
      }),
      recordFailed: async (reason) => ({ status: "failed", reason }),
    });

    assert.deepStrictEqual(result, {
      status: "not_configured",
      reason: "missing_from_address",
    });
  });
});
