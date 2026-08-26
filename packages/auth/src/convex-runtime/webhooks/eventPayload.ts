export type ConvexWebhookPayloadInput = {
  id: string;
  type: string;
  apiVersion: string;
  createdAt: number;
  organizationId: string;
  data: Record<string, unknown>;
};

export function createConvexWebhookEventId(
  prefix = "evt",
  now = Date.now(),
  random = Math.random
): string {
  const suffix = random().toString(36).slice(2, 10);
  return `${prefix}_${now}_${suffix}`;
}

export function buildConvexWebhookPayload(
  input: ConvexWebhookPayloadInput
): string {
  return JSON.stringify({
    api_version: input.apiVersion,
    created_at: new Date(input.createdAt).toISOString(),
    data: input.data,
    id: input.id,
    organization_id: input.organizationId,
    type: input.type,
  });
}
