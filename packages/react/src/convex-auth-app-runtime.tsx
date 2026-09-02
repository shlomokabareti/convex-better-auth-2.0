import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useEffect, type ReactNode } from "react";

import { AuthRuntimeProvider } from "./AuthRuntimeProvider";
import type { NativeAuthActions } from "./ConvexAuthProvider";
import { useConvexAuthClient } from "./convex-auth-client";
import { ConvexAuthClientProvider } from "./convex-auth-client-provider";
import { DEFAULT_AUTH_RUNTIME_STATUS } from "./types";
import { useConvexAuthUser } from "./auth-client-hooks";
import type { ConvexAuthUserState } from "./auth-client-types";

export type ConvexAuthAppProviderProps = {
  children: ReactNode;
  actions: NativeAuthActions;
  storage?: "local" | "session";
};

/**
 * Native app runtime provider. Wraps the app with `ConvexAuthClientProvider`
 * and exposes the same `AuthRuntimeProvider` status boundary that the Better
 * Auth runtime uses, so existing route guards keep working.
 */
export function ConvexAuthAppProvider(props: ConvexAuthAppProviderProps) {
  return (
    <ConvexAuthClientProvider actions={props.actions} storage={props.storage}>
      <AuthRuntimeProvider status={DEFAULT_AUTH_RUNTIME_STATUS}>
        {props.children}
      </AuthRuntimeProvider>
    </ConvexAuthClientProvider>
  );
}

/**
 * Native user state for authenticated route guards. Computes the same
 * `ConvexAuthUserState` shape as the Better Auth runtime without an explicit
 * `authClient` prop.
 */
export function useConvexAuthAppUser(): ConvexAuthUserState {
  const client = useConvexAuthClient();
  return useConvexAuthUser(client);
}

type EmptyArgs = Record<string, never>;

export type ConvexAuthIdentityProvisionerProps = {
  /**
   * Convex query that returns the current authenticated user once the session
   * is active. Used to detect when the native session has propagated.
   */
  getCurrentUser: FunctionReference<"query", "public", EmptyArgs, unknown>;
  /**
   * Called once when the current user record becomes available. Consumers use
   * this to finalize their own initialization (e.g., invalidate router cache).
   */
  onProvisioned?: () => void;
};

/**
 * Identity provisioner for the native runtime. Mirrors the Better Auth
 * provisioner: it watches until `getCurrentUser` resolves, then calls
 * `onProvisioned`.
 */
export function ConvexAuthIdentityProvisioner(props: ConvexAuthIdentityProvisionerProps) {
  const user = useQuery(props.getCurrentUser, {});

  useEffect(() => {
    if (user !== undefined) {
      props.onProvisioned?.();
    }
  }, [user, props.onProvisioned]);

  return null;
}
