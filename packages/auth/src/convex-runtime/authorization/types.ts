export type PermissionCheckInput = {
  permission: string;
  organizationRequired?: boolean;
};

export type AuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "SESSION_REQUIRED"
  | "ORGANIZATION_REQUIRED"
  | "PERMISSION_REQUIRED"
  | "PRINCIPAL_RESTRICTED";

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string | null;
  code: AuthorizationFailureCode | null;
};

export type RestrictionDecision = {
  allowed: boolean;
  reason: string | null;
  code: AuthorizationFailureCode | null;
};
