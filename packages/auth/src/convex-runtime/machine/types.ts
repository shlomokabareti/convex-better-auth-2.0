export type ApiKeyOwnerType = "user" | "organization" | "service";

export type ApiKeyRecord = {
  apiKeyId: string;
  ownerType: ApiKeyOwnerType;
  ownerId: string;
  fixedOrganizationId: string | null;
  permissions: string[] | null;
  scopes: string[] | null;
  status: "active" | "revoked" | "expired" | "idle_timeout";
  expiresAt: number | null;
  createdAt?: number | null;
  lastUsedAt?: number | null;
  maxIdleMs?: number | null;
};

export type ServicePrincipalRecord = {
  serviceId: string;
  organizationId: string | null;
  permissions: string[];
  status: "active" | "disabled";
};
