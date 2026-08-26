import type { ConvexWebhookDeliveryOutcome, ConvexWebhookFailureKind } from "./types";

const defaultMaxResponseBodyLength = 2_000;

export type ConvexWebhookOutcomeOptions = {
  maxResponseBodyLength?: number;
};

function trimResponseBody(body: string, options?: ConvexWebhookOutcomeOptions): string {
  return body.slice(0, options?.maxResponseBodyLength ?? defaultMaxResponseBodyLength);
}

export function classifyConvexWebhookHttpResult(args: {
  statusCode: number;
  responseBody: string;
  attemptCount: number;
  maxAttempts: number;
  options?: ConvexWebhookOutcomeOptions;
}): ConvexWebhookDeliveryOutcome {
  const { statusCode, responseBody, attemptCount, maxAttempts, options } = args;

  if (statusCode >= 200 && statusCode < 300) {
    return {
      status: "delivered",
      responseStatus: statusCode,
      responseBody: trimResponseBody(responseBody, options),
    };
  }

  const failureKind: ConvexWebhookFailureKind =
    statusCode === 429 ? "rate_limited" : statusCode >= 500 ? "server_error" : "client_error";

  const status =
    failureKind === "client_error" ? "failed" : attemptCount >= maxAttempts ? "failed" : "pending";

  return {
    status,
    responseStatus: statusCode,
    responseBody: trimResponseBody(responseBody, options),
    failureKind,
  };
}

export function classifyConvexWebhookExecutionError(args: {
  message: string;
  attemptCount: number;
  maxAttempts: number;
  options?: ConvexWebhookOutcomeOptions;
}): ConvexWebhookDeliveryOutcome {
  const { message, attemptCount, maxAttempts, options } = args;
  return {
    status: attemptCount >= maxAttempts ? "failed" : "pending",
    responseBody: trimResponseBody(message, options),
    failureKind: "network_error",
  };
}

export function classifyInactiveConvexWebhookEndpointOutcome(
  message = "Endpoint not found or inactive",
): ConvexWebhookDeliveryOutcome {
  return {
    status: "failed",
    responseBody: message,
    failureKind: "endpoint_inactive",
  };
}
