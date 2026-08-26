const defaultInitialRetryBackoffMs = 30 * 1000;
const defaultMaxRetryBackoffMs = 15 * 60 * 1000;
const defaultJitterWindowRatio = 0.2;

export type ConvexWebhookRetryPolicyOptions = {
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  jitterWindowRatio?: number;
};

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function resolveRetryOptions(
  options?: ConvexWebhookRetryPolicyOptions
): Required<ConvexWebhookRetryPolicyOptions> {
  return {
    initialBackoffMs: options?.initialBackoffMs ?? defaultInitialRetryBackoffMs,
    jitterWindowRatio: options?.jitterWindowRatio ?? defaultJitterWindowRatio,
    maxBackoffMs: options?.maxBackoffMs ?? defaultMaxRetryBackoffMs,
  };
}

export function getConvexWebhookExponentialBackoffMs(
  attemptCount: number,
  options?: ConvexWebhookRetryPolicyOptions
): number {
  const resolved = resolveRetryOptions(options);
  const retryNumber = Math.max(1, attemptCount);
  return Math.min(
    resolved.initialBackoffMs * 2 ** (retryNumber - 1),
    resolved.maxBackoffMs
  );
}

export function getConvexWebhookJitteredBackoffMs(
  attemptCount: number,
  deliveryKey: string,
  options?: ConvexWebhookRetryPolicyOptions
): number {
  const resolved = resolveRetryOptions(options);
  const baseBackoffMs = getConvexWebhookExponentialBackoffMs(
    attemptCount,
    resolved
  );
  const jitterWindowMs = Math.floor(baseBackoffMs * resolved.jitterWindowRatio);
  if (jitterWindowMs <= 0) {
    return baseBackoffMs;
  }

  const hash = hashString(deliveryKey);
  const jitterOffset = hash % (jitterWindowMs + 1);
  return Math.min(baseBackoffMs + jitterOffset, resolved.maxBackoffMs);
}

export function getConvexWebhookRetryAt(args: {
  attemptCount: number;
  now: number;
  deliveryKey: string;
  options?: ConvexWebhookRetryPolicyOptions;
}): number {
  return (
    args.now +
    getConvexWebhookJitteredBackoffMs(
      args.attemptCount,
      args.deliveryKey,
      args.options
    )
  );
}
