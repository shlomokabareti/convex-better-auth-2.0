import type { AuthRuntimeStatus } from "../types";

import { mapBetterAuthReadiness } from "../bridge/mapBetterAuthReadiness";
import type {
  BetterAuthClientBridgeInput,
  BetterAuthClientBridgeState,
} from "./types";

export function createBetterAuthBridgeState(
  input: BetterAuthClientBridgeInput
): BetterAuthClientBridgeState {
  const runtimeStatus: AuthRuntimeStatus = {
    state: mapBetterAuthReadiness({
      providerAuthenticated: input.providerState.isAuthenticated,
      providerLoading: input.providerState.isLoading,
      tokenAvailable: input.providerState.hasToken,
      convexAuthenticated: input.convexAuthenticated,
      terminalFailure: input.terminalFailure ?? false,
      recovering: input.recovering ?? input.providerState.isLoading,
    }),
    providerAuthenticated: input.providerState.isAuthenticated,
    tokenAvailable: input.providerState.hasToken,
    convexAuthenticated: input.convexAuthenticated,
    isRecovering: input.recovering ?? input.providerState.isLoading,
    reauthRequired: input.terminalFailure ?? false,
  };

  return {
    providerState: input.providerState,
    runtimeStatus,
  };
}
