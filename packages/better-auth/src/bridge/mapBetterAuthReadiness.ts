import type { AuthReadinessState } from "../types";

import type { BetterAuthBridgeInputs, BetterAuthReadinessMapper } from "./types";

export const mapBetterAuthReadiness: BetterAuthReadinessMapper = (
  inputs: BetterAuthBridgeInputs,
): AuthReadinessState => {
  if (inputs.terminalFailure) {
    return "reauthRequired";
  }

  if (inputs.providerLoading) {
    return inputs.providerAuthenticated ? "providerReady" : "providerLoading";
  }

  if (!inputs.providerAuthenticated) {
    return inputs.recovering ? "degraded" : "signedOut";
  }

  if (!inputs.tokenAvailable) {
    return inputs.recovering ? "tokenRefreshing" : "providerReady";
  }

  if (!inputs.convexAuthenticated) {
    return inputs.recovering ? "convexConnecting" : "tokenReady";
  }

  return "convexReady";
};
