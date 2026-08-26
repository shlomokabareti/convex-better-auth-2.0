import { normalizeBetterAuthIdentity } from "../bridge/normalizeBetterAuthIdentity";
import { createBetterAuthBridgeState } from "./createBetterAuthBridgeState";
import type {
  BetterAuthClientSessionResult,
  BetterAuthRuntimeSnapshot,
  BetterAuthRuntimeSnapshotInput,
} from "./types";

export function deriveBetterAuthRuntimeSnapshot(
  input: BetterAuthRuntimeSnapshotInput,
): BetterAuthRuntimeSnapshot {
  const providerState = sessionResultToProviderState(input.session);
  const bridgeState = createBetterAuthBridgeState({
    providerState,
    convexAuthenticated: input.convexAuthenticated && providerState.isAuthenticated,
    terminalFailure: input.terminalFailure ?? input.session.error !== null,
    recovering: input.recovering ?? input.session.isRefetching,
  });

  return {
    identity:
      input.session.data === null
        ? null
        : normalizeBetterAuthIdentity({
            subject: input.session.data.user.id,
            issuer: input.issuer,
            email: input.session.data.user.email,
            emailVerified: input.session.data.user.emailVerified,
            name: input.session.data.user.name,
            imageUrl: input.session.data.user.image ?? null,
            sessionId: input.session.data.session.id,
            rawClaims: {
              session: input.session.data.session,
              user: input.session.data.user,
            },
          }),
    providerState: bridgeState.providerState,
    runtimeStatus: bridgeState.runtimeStatus,
    error: input.session.error,
  };
}

function sessionResultToProviderState(session: BetterAuthClientSessionResult) {
  return {
    isAuthenticated: session.data !== null,
    isLoading: session.isPending,
    hasToken: session.data?.session.token !== undefined && session.data?.session.token !== null,
  };
}
