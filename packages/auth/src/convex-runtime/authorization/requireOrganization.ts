import type { ResolvedAuthContext } from "../coreTypes";
import { authorizeOrganization } from "./authorize";

export function requireOrganization(context: ResolvedAuthContext): string {
  const decision = authorizeOrganization(context);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "Organization context required");
  }

  const organizationId = context.execution.organizationId;
  if (organizationId === null) {
    throw new Error("Organization context required");
  }
  return organizationId;
}
