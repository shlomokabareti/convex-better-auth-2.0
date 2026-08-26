import type { ResolvedAuthContext } from "../coreTypes";
import { principalIdForAuditContext } from "./principalAudit";
import type { AuthAuditEvent } from "./types";

export type CreateAuthAuditEventInput = {
  eventType: string;
  context: ResolvedAuthContext;
  success: boolean;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export function createAuthAuditEvent(
  input: CreateAuthAuditEventInput
): AuthAuditEvent {
  return {
    eventType: input.eventType,
    principalKind: input.context.principal.kind,
    principalId: principalIdForAuditContext(input.context),
    organizationId: input.context.execution.organizationId,
    resourceType: input.resourceType ?? input.context.execution.resourceType,
    resourceId: input.resourceId ?? input.context.execution.resourceId,
    success: input.success,
    metadata: input.metadata,
  };
}
