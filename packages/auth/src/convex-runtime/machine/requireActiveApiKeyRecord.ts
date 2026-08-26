import { resolveApiKeyRecordStatus } from "./resolveApiKeyRecordStatus";
import type { ApiKeyRecord } from "./types";

export function requireActiveApiKeyRecord(
  apiKey: Pick<ApiKeyRecord, "status" | "expiresAt" | "createdAt" | "lastUsedAt" | "maxIdleMs">,
  now: number = Date.now(),
): void {
  const status = resolveApiKeyRecordStatus(apiKey, now);

  if (status !== "active") {
    throw new Error(`API key is not active: ${status}`);
  }
}
