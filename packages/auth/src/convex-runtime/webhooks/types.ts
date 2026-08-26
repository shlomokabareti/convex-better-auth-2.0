export type ConvexWebhookEndpointStatus = "active" | "disabled" | "archived";

export type ConvexWebhookDeliveryStatus = "pending" | "processing" | "delivered" | "failed";

export type ConvexWebhookFailureKind =
  | "endpoint_inactive"
  | "network_error"
  | "rate_limited"
  | "server_error"
  | "client_error"
  | "unknown_error";

export type ConvexWebhookDeliveryOutcome =
  | {
      status: "delivered";
      responseStatus: number;
      responseBody: string;
      failureKind?: undefined;
    }
  | {
      status: "pending" | "failed";
      responseStatus?: number;
      responseBody: string;
      failureKind: ConvexWebhookFailureKind;
    };

export type ConvexWebhookEventLockRecord = {
  status: "pending" | "processed";
  claimedAt: number;
};

export type ConvexWebhookEventLockDecision =
  | {
      action: "insert";
      alreadyProcessed: false;
      alreadyProcessing: false;
    }
  | {
      action: "processed";
      alreadyProcessed: true;
      alreadyProcessing: false;
    }
  | {
      action: "inflight";
      alreadyProcessed: false;
      alreadyProcessing: true;
    }
  | {
      action: "reclaim";
      alreadyProcessed: false;
      alreadyProcessing: false;
    };
