import type { ApiKeyRecord } from "./types";

export function resolveApiKeyRecordStatus(
  apiKey: Pick<ApiKeyRecord, "status" | "expiresAt" | "createdAt" | "lastUsedAt" | "maxIdleMs">,
  now: number = Date.now(),
): "active" | "revoked" | "expired" | "idle_timeout" {
  if (apiKey.status === "revoked") {
    return "revoked";
  }
  if (apiKey.status === "idle_timeout") {
    return "idle_timeout";
  }
  if (apiKey.expiresAt !== null && apiKey.expiresAt <= now) {
    return "expired";
  }
  if (apiKey.maxIdleMs !== null && apiKey.maxIdleMs !== undefined) {
    const idleSince = apiKey.lastUsedAt ?? apiKey.createdAt;
    if (idleSince !== null && idleSince !== undefined && idleSince + apiKey.maxIdleMs <= now) {
      return "idle_timeout";
    }
  }
  return apiKey.status;
}
