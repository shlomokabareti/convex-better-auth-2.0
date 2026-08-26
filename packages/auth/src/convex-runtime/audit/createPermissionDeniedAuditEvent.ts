import type { ResolvedAuthContext } from "../coreTypes";
import { createAuthorizationDeniedAuditEvent } from "./createAuthorizationDeniedAuditEvent";
import type { AuthAuditEvent } from "./types";

export function createPermissionDeniedAuditEvent(args: {
  context: ResolvedAuthContext;
  permission: string;
  reasonDetail?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}): AuthAuditEvent {
  return createAuthorizationDeniedAuditEvent({
    context: args.context,
    denialReason: "permission",
    denialCode: "PERMISSION_REQUIRED",
    reasonDetail: args.reasonDetail,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    metadata: {
      permission: args.permission,
    },
  });
}
