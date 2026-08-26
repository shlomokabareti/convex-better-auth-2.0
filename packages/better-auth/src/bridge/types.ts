import type { AuthReadinessState, NormalizedAuthIdentity } from "../types";

import type { BetterAuthServerIdentity } from "../server/types";

export type BetterAuthBridgeInputs = {
  providerAuthenticated: boolean;
  providerLoading: boolean;
  tokenAvailable: boolean;
  convexAuthenticated: boolean;
  terminalFailure: boolean;
  recovering: boolean;
};

export type BetterAuthReadinessMapper = (inputs: BetterAuthBridgeInputs) => AuthReadinessState;

export type BetterAuthIdentityMapper = (
  identity: BetterAuthServerIdentity,
) => NormalizedAuthIdentity;
