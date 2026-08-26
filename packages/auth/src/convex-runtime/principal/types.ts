import type {
  AgentPrincipal,
  ApiKeyPrincipal,
  AuthPrincipal,
  ExecutionContext,
  OAuthClientPrincipal,
  ResolvedAuthContext,
  ServicePrincipal,
  UserPrincipal,
} from "../coreTypes";

export type PrincipalResolutionInput = {
  credentialType:
    | "userToken"
    | "apiKey"
    | "agentCredential"
    | "serviceCredential"
    | "oauthToken"
    | "anonymous";
  organizationId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  audience?: string | null;
  scopes?: string[];
};

export type PrincipalResolutionResult = ResolvedAuthContext & {
  principal: AuthPrincipal;
  execution: ExecutionContext;
};

export type PrincipalResolutionRequest =
  | ({ credentialType: "anonymous" } & Omit<
      PrincipalResolutionInput,
      "credentialType"
    >)
  | ({ credentialType: "userToken"; principal: UserPrincipal } & Omit<
      PrincipalResolutionInput,
      "credentialType"
    >)
  | ({ credentialType: "agentCredential"; principal: AgentPrincipal } & Omit<
      PrincipalResolutionInput,
      "credentialType"
    >)
  | ({
      credentialType: "serviceCredential";
      principal: ServicePrincipal;
    } & Omit<PrincipalResolutionInput, "credentialType">)
  | ({ credentialType: "apiKey"; principal: ApiKeyPrincipal } & Omit<
      PrincipalResolutionInput,
      "credentialType"
    >)
  | ({ credentialType: "oauthToken"; principal: OAuthClientPrincipal } & Omit<
      PrincipalResolutionInput,
      "credentialType"
    >);
