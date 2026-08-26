import { resolveServicePrincipalStatus } from "./resolveServicePrincipalStatus";
import type { ServicePrincipalRecord } from "./types";

export function requireActiveServicePrincipal(
  servicePrincipal: Pick<ServicePrincipalRecord, "status">,
): void {
  const status = resolveServicePrincipalStatus(servicePrincipal);

  if (status !== "active") {
    throw new Error(`Service principal is not active: ${status}`);
  }
}
