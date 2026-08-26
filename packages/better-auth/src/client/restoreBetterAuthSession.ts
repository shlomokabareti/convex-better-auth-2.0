import { normalizeBetterAuthIdentity } from "../bridge/normalizeBetterAuthIdentity";
import { createBetterAuthBridgeState } from "./createBetterAuthBridgeState";
import type {
  BetterAuthRestoredSession,
  BetterAuthSessionSnapshot,
} from "./types";

export function restoreBetterAuthSession(
  snapshot: BetterAuthSessionSnapshot
): BetterAuthRestoredSession {
  const bridgeState = createBetterAuthBridgeState({
    providerState: snapshot.providerState,
    convexAuthenticated: snapshot.convexAuthenticated,
    terminalFailure: snapshot.terminalFailure,
    recovering: snapshot.recovering,
  });

  return {
    identity:
      snapshot.identity === null
        ? null
        : normalizeBetterAuthIdentity(snapshot.identity),
    providerState: bridgeState.providerState,
    runtimeStatus: bridgeState.runtimeStatus,
  };
}
