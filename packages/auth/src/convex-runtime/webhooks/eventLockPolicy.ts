import type {
  ConvexWebhookEventLockDecision,
  ConvexWebhookEventLockRecord,
} from "./types";

const defaultStaleClaimMs = 5 * 60 * 1000;

export function decideConvexWebhookEventLock(args: {
  existing: ConvexWebhookEventLockRecord | null;
  now: number;
  staleClaimMs?: number;
}): ConvexWebhookEventLockDecision {
  if (!args.existing) {
    return {
      action: "insert",
      alreadyProcessed: false,
      alreadyProcessing: false,
    };
  }

  if (args.existing.status === "processed") {
    return {
      action: "processed",
      alreadyProcessed: true,
      alreadyProcessing: false,
    };
  }

  if (
    args.existing.claimedAt >
    args.now - (args.staleClaimMs ?? defaultStaleClaimMs)
  ) {
    return {
      action: "inflight",
      alreadyProcessed: false,
      alreadyProcessing: true,
    };
  }

  return {
    action: "reclaim",
    alreadyProcessed: false,
    alreadyProcessing: false,
  };
}
