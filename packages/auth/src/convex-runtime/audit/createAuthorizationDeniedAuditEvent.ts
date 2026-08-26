import type { ResolvedAuthContext } from "../coreTypes";
import { createAuthAuditEvent } from "./createAuthAuditEvent";
import type { AuthAuditEvent } from "./types";

export type AuthorizationDeniedReason =
  | "permission"
  | "restriction"
  | "organization"
  | "authentication"
  | "unknown";

export function createAuthorizationDeniedAuditEvent(args: {
  context: ResolvedAuthContext;
  denialReason: AuthorizationDeniedReason;
  denialCode?: string | null;
  reasonDetail?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): AuthAuditEvent {
  return createAuthAuditEvent({
    eventType: "auth.authorization_denied",
    context: args.context,
    success: false,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    metadata: {
      denialReason: args.denialReason,
      ...(typeof args.denialCode === "string"
        ? {
            denialCode: args.denialCode,
          }
        : {}),
      ...(typeof args.reasonDetail === "string"
        ? {
            reasonDetail: args.reasonDetail,
          }
        : {}),
      ...args.metadata,
    },
  });
}
