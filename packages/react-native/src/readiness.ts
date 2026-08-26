import type { AuthRuntimeStatus } from "convex-better-auth";

export type VortexExpoSessionState = {
  data?: unknown;
  error?: unknown;
  isPending: boolean;
};

export type VortexExpoConvexAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export function mapVortexExpoAuthReadiness(args: {
  convex: VortexExpoConvexAuthState;
  session: VortexExpoSessionState;
}): AuthRuntimeStatus {
  const providerAuthenticated =
    args.session.data !== null && args.session.data !== undefined;
  const reauthRequired =
    args.session.error !== null && args.session.error !== undefined;

  if (reauthRequired) {
    return {
      convexAuthenticated: false,
      isRecovering: false,
      providerAuthenticated,
      reauthRequired: true,
      state: "reauthRequired",
      tokenAvailable: false,
    };
  }

  if (args.session.isPending) {
    return {
      convexAuthenticated: false,
      isRecovering: true,
      providerAuthenticated: false,
      reauthRequired: false,
      state: "providerLoading",
      tokenAvailable: false,
    };
  }

  if (!providerAuthenticated) {
    return {
      convexAuthenticated: false,
      isRecovering: false,
      providerAuthenticated: false,
      reauthRequired: false,
      state: "signedOut",
      tokenAvailable: false,
    };
  }

  if (args.convex.isLoading) {
    return {
      convexAuthenticated: false,
      isRecovering: true,
      providerAuthenticated: true,
      reauthRequired: false,
      state: "convexConnecting",
      tokenAvailable: true,
    };
  }

  return {
    convexAuthenticated: args.convex.isAuthenticated,
    isRecovering: !args.convex.isAuthenticated,
    providerAuthenticated: true,
    reauthRequired: false,
    state: args.convex.isAuthenticated ? "convexReady" : "tokenReady",
    tokenAvailable: true,
  };
}
