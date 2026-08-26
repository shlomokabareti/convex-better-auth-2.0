import type { ResolvedAuthContext } from "../coreTypes";
import { createAuthorizationDeniedAuditEvent } from "./createAuthorizationDeniedAuditEvent";
import type { AuthAuditEvent } from "./types";

export function createRestrictionDeniedAuditEvent(args: {
  context: ResolvedAuthContext;
  reasonDetail?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): AuthAuditEvent {
  return createAuthorizationDeniedAuditEvent({
    context: args.context,
    denialReason: "restriction",
    denialCode: "PRINCIPAL_RESTRICTED",
    reasonDetail: args.reasonDetail,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    metadata: args.metadata,
  });
}
