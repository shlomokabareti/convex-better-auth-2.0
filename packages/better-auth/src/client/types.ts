import type { AuthRuntimeStatus, NormalizedAuthIdentity } from "../types";

import type { BetterAuthServerIdentity } from "../server/types";

export type BetterAuthClientSessionState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  hasToken: boolean;
};

export type BetterAuthClientBridgeInput = {
  providerState: BetterAuthClientSessionState;
  convexAuthenticated: boolean;
  terminalFailure?: boolean;
  recovering?: boolean;
};

export type BetterAuthClientBridgeState = {
  providerState: BetterAuthClientSessionState;
  runtimeStatus: AuthRuntimeStatus;
};

export type BetterAuthSessionRecord = {
  id: string;
  token?: string | null;
};

export type BetterAuthUserRecord = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
};

export type BetterAuthSessionPayload = {
  session: BetterAuthSessionRecord;
  user: BetterAuthUserRecord;
};

export type BetterAuthClientSessionResult = {
  data: BetterAuthSessionPayload | null;
  isPending: boolean;
  isRefetching: boolean;
  error: Error | null;
};

export type BetterAuthSessionSnapshot = {
  identity: BetterAuthServerIdentity | null;
  providerState: BetterAuthClientSessionState;
  convexAuthenticated: boolean;
  terminalFailure?: boolean;
  recovering?: boolean;
};

export type BetterAuthRestoredSession = {
  identity: NormalizedAuthIdentity | null;
  providerState: BetterAuthClientSessionState;
  runtimeStatus: AuthRuntimeStatus;
};

export type BetterAuthRuntimeSnapshotInput = {
  issuer: string;
  session: BetterAuthClientSessionResult;
  convexAuthenticated: boolean;
  terminalFailure?: boolean;
  recovering?: boolean;
};

export type BetterAuthRuntimeSnapshot = BetterAuthRestoredSession & {
  error: Error | null;
};
