import type { AuthorizationFailureCode } from "../authorization/types";
import type { ResolvedAuthContext } from "../coreTypes";
import type { AuthorizationDeniedReason } from "./createAuthorizationDeniedAuditEvent";
import { principalIdForAuditContext } from "./principalAudit";

export type AuthorizationDeniedAuditPayload = {
  actorUserId?: string;
  principalKind: string;
  principalId: string | null;
  organizationId?: string;
  denialReason: AuthorizationDeniedReason;
  denialCode: AuthorizationFailureCode | null;
  reasonDetail: string | null;
  resourceType: string;
  resourceId: string;
  permission?: string;
};

export type AuthorizationDeniedErrorData = {
  code: string;
  message: string;
  authzCode: AuthorizationFailureCode | null;
  actorUserId?: string;
  principalKind: string;
  principalId: string | null;
  organizationId?: string;
  denialReason: AuthorizationDeniedReason;
  resourceType: string;
  resourceId: string;
  permission?: string;
};

const authorizationDeniedReasons: readonly AuthorizationDeniedReason[] = [
  "permission",
  "restriction",
  "organization",
  "authentication",
  "unknown",
];

const authorizationFailureCodes: readonly AuthorizationFailureCode[] = [
  "AUTHENTICATION_REQUIRED",
  "SESSION_REQUIRED",
  "ORGANIZATION_REQUIRED",
  "PERMISSION_REQUIRED",
  "PRINCIPAL_RESTRICTED",
];

export function createAuthorizationDeniedErrorData(input: {
  code: string;
  message: string;
  authzCode?: AuthorizationFailureCode | null;
  actorUserId?: string;
  principalKind: string;
  principalId: string | null;
  organizationId?: string;
  denialReason: AuthorizationDeniedReason;
  resourceType: string;
  resourceId: string;
  permission?: string;
}): AuthorizationDeniedErrorData {
  return {
    code: input.code,
    message: input.message,
    authzCode: input.authzCode ?? null,
    actorUserId: input.actorUserId,
    principalKind: input.principalKind,
    principalId: input.principalId,
    organizationId: input.organizationId,
    denialReason: input.denialReason,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    permission: input.permission,
  };
}

export function createAuthorizationDeniedErrorDataFromContext(input: {
  context: ResolvedAuthContext;
  code: string;
  message: string;
  authzCode?: AuthorizationFailureCode | null;
  actorUserId?: string;
  denialReason: AuthorizationDeniedReason;
  resourceType?: string | null;
  resourceId?: string | null;
  permission?: string;
}): AuthorizationDeniedErrorData {
  const resourceType =
    input.resourceType ?? input.context.execution.resourceType;
  const resourceId = input.resourceId ?? input.context.execution.resourceId;

  if (resourceType === null || resourceId === null) {
    throw new Error(
      "Authorization denied error data requires resourceType and resourceId"
    );
  }

  return createAuthorizationDeniedErrorData({
    code: input.code,
    message: input.message,
    authzCode: input.authzCode,
    actorUserId: input.actorUserId,
    principalKind: input.context.principal.kind,
    principalId: principalIdForAuditContext(input.context),
    organizationId: input.context.execution.organizationId ?? undefined,
    denialReason: input.denialReason,
    resourceType,
    resourceId,
    permission: input.permission,
  });
}

export function toAuthorizationDeniedAuditPayload(
  errorData: AuthorizationDeniedErrorData
): AuthorizationDeniedAuditPayload {
  return {
    actorUserId: errorData.actorUserId,
    principalKind: errorData.principalKind,
    principalId: errorData.principalId,
    organizationId: errorData.organizationId,
    denialReason: errorData.denialReason,
    denialCode: errorData.authzCode,
    reasonDetail: errorData.message,
    resourceType: errorData.resourceType,
    resourceId: errorData.resourceId,
    permission: errorData.permission,
  };
}

export function extractAuthorizationDeniedAuditPayload(
  error: unknown
): AuthorizationDeniedAuditPayload | null {
  const record = extractErrorDataRecord(error);
  if (record === null) {
    return null;
  }

  const required = extractRequiredAuthorizationDeniedFields(record);
  if (required === null) {
    return null;
  }

  return {
    actorUserId:
      typeof record.actorUserId === "string" ? record.actorUserId : undefined,
    principalKind: required.principalKind,
    principalId:
      typeof record.principalId === "string" ? record.principalId : null,
    organizationId:
      typeof record.organizationId === "string"
        ? record.organizationId
        : undefined,
    denialReason: required.denialReason,
    denialCode: isAuthorizationFailureCode(record.authzCode)
      ? record.authzCode
      : null,
    reasonDetail: typeof record.message === "string" ? record.message : null,
    resourceType: required.resourceType,
    resourceId: required.resourceId,
    permission:
      typeof record.permission === "string" ? record.permission : undefined,
  };
}

function extractErrorDataRecord(
  error: unknown
): Record<string, unknown> | null {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null;
  }
  const data = Reflect.get(error, "data");
  return typeof data === "object" && data !== null
    ? Object.fromEntries(Object.entries(data))
    : null;
}

function extractRequiredAuthorizationDeniedFields(
  record: Record<string, unknown>
): Pick<
  AuthorizationDeniedAuditPayload,
  "denialReason" | "principalKind" | "resourceId" | "resourceType"
> | null {
  const denialReason = isAuthorizationDeniedReason(record.denialReason)
    ? record.denialReason
    : null;
  const principalKind =
    typeof record.principalKind === "string" ? record.principalKind : null;
  const resourceType =
    typeof record.resourceType === "string" ? record.resourceType : null;
  const resourceId =
    typeof record.resourceId === "string" ? record.resourceId : null;

  if (
    denialReason === null ||
    principalKind === null ||
    resourceType === null ||
    resourceId === null
  ) {
    return null;
  }

  return { denialReason, principalKind, resourceId, resourceType };
}

function isAuthorizationDeniedReason(
  value: unknown
): value is AuthorizationDeniedReason {
  return (
    typeof value === "string" &&
    authorizationDeniedReasons.some((reason) => reason === value)
  );
}

function isAuthorizationFailureCode(
  value: unknown
): value is AuthorizationFailureCode {
  return (
    typeof value === "string" &&
    authorizationFailureCodes.some((code) => code === value)
  );
}
