import type {
  AgentCredentialAuthorityAdapter,
  AgentCredentialAuthorityResult,
  AgentCredentialVerificationMaterial,
} from "./resolveActiveAgentPrincipal";

type VerificationMaterialInput = Parameters<
  AgentCredentialAuthorityAdapter["getVerificationMaterial"]
>[0];
type ConsumeCredentialInput = Parameters<AgentCredentialAuthorityAdapter["consumeCredential"]>[0];

export type ConvexAgentCredentialAuthorityAdapterConfig<
  TVerificationMaterialQueryReference,
  TConsumeCredentialMutationReference,
> = {
  runQuery: (
    reference: TVerificationMaterialQueryReference,
    args: VerificationMaterialInput,
  ) => Promise<AgentCredentialVerificationMaterial | null>;
  runMutation: (
    reference: TConsumeCredentialMutationReference,
    args: ConsumeCredentialInput,
  ) => Promise<AgentCredentialAuthorityResult>;
  refs: {
    getAgentVerificationMaterial: TVerificationMaterialQueryReference;
    consumeAgentCredential: TConsumeCredentialMutationReference;
  };
};

/**
 * Wires the provider-neutral agent credential verifier to the Convex Auth
 * Convex component without exposing component implementation details.
 */
export function createConvexAgentCredentialAuthorityAdapter<
  TVerificationMaterialQueryReference,
  TConsumeCredentialMutationReference,
>(
  config: ConvexAgentCredentialAuthorityAdapterConfig<
    TVerificationMaterialQueryReference,
    TConsumeCredentialMutationReference
  >,
): AgentCredentialAuthorityAdapter {
  return {
    async getVerificationMaterial(input) {
      return await config.runQuery(config.refs.getAgentVerificationMaterial, input);
    },
    async consumeCredential(input) {
      return await config.runMutation(config.refs.consumeAgentCredential, input);
    },
  };
}
