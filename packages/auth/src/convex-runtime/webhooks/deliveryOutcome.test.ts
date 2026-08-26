import assert from "node:assert/strict";

import { describe, it } from "vitest";

import {
  classifyInactiveConvexWebhookEndpointOutcome,
  classifyConvexWebhookExecutionError,
  classifyConvexWebhookHttpResult,
} from "./deliveryOutcome";

describe("webhook delivery outcomes", () => {
  it("classifies successful webhook responses as delivered", () => {
    assert.deepEqual(
      classifyConvexWebhookHttpResult({
        statusCode: 204,
        responseBody: "ok",
        attemptCount: 1,
        maxAttempts: 4,
      }),
      {
        status: "delivered",
        responseStatus: 204,
        responseBody: "ok",
      }
    );
  });

  it("classifies 429 as retryable rate limit", () => {
    assert.deepEqual(
      classifyConvexWebhookHttpResult({
        statusCode: 429,
        responseBody: "slow down",
        attemptCount: 1,
        maxAttempts: 4,
      }),
      {
        status: "pending",
        responseStatus: 429,
        responseBody: "slow down",
        failureKind: "rate_limited",
      }
    );
  });

  it("classifies non-429 4xx as terminal client errors", () => {
    assert.deepEqual(
      classifyConvexWebhookHttpResult({
        statusCode: 404,
        responseBody: "missing",
        attemptCount: 1,
        maxAttempts: 4,
      }),
      {
        status: "failed",
        responseStatus: 404,
        responseBody: "missing",
        failureKind: "client_error",
      }
    );
  });

  it("keeps 5xx retryable until max attempts", () => {
    assert.deepEqual(
      classifyConvexWebhookHttpResult({
        statusCode: 503,
        responseBody: "down",
        attemptCount: 1,
        maxAttempts: 4,
      }),
      {
        status: "pending",
        responseStatus: 503,
        responseBody: "down",
        failureKind: "server_error",
      }
    );
  });

  it("classifies thrown execution errors as network failures", () => {
    assert.deepEqual(
      classifyConvexWebhookExecutionError({
        message: "fetch failed",
        attemptCount: 2,
        maxAttempts: 4,
      }),
      {
        status: "pending",
        responseBody: "fetch failed",
        failureKind: "network_error",
      }
    );
  });

  it("classifies inactive endpoint separately", () => {
    assert.deepEqual(classifyInactiveConvexWebhookEndpointOutcome(), {
      status: "failed",
      responseBody: "Endpoint not found or inactive",
      failureKind: "endpoint_inactive",
    });
  });
});
