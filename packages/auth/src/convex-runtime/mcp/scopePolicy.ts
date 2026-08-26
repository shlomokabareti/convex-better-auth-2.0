import type { McpOAuthClient } from "./types";

export function findMcpOAuthClientDisallowedScope(
  client: Pick<McpOAuthClient, "allowedScopes">,
  requestedScopes: readonly string[]
): string | null {
  const allowedScopes = new Set(client.allowedScopes);
  return requestedScopes.find((scope) => !allowedScopes.has(scope)) ?? null;
}
