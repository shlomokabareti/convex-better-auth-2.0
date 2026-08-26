import type { OAuthClientPrincipal } from "../coreTypes";

export type OAuthClientPrincipalInput = {
  clientId: string;
  subjectType: "user" | "service" | "client";
  subjectId: string | null;
  organizationId: string | null;
  audience: string | null;
  scopes: string[];
  permissions: string[];
  isRestricted?: boolean;
  restrictedReason?: string | null;
};

export function resolveOAuthClientPrincipal(
  input: OAuthClientPrincipalInput,
): OAuthClientPrincipal {
  return {
    kind: "oauthClient",
    clientId: input.clientId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    organizationId: input.organizationId,
    audience: input.audience,
    scopes: input.scopes,
    permissions: input.permissions,
    isRestricted: input.isRestricted ?? false,
    restrictedReason: input.restrictedReason ?? null,
  };
}
