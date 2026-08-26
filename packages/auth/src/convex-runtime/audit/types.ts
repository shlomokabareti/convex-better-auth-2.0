export type AuthAuditMetadata = Record<string, unknown>;

export type AuthAuditEvent = {
  eventType: string;
  principalKind: string;
  principalId: string | null;
  organizationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  metadata?: AuthAuditMetadata;
};
