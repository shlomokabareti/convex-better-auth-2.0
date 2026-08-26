import type { ServicePrincipalRecord } from "./types";

export function resolveServicePrincipalStatus(
  servicePrincipal: Pick<ServicePrincipalRecord, "status">
): "active" | "disabled" {
  return servicePrincipal.status;
}
