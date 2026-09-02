import { useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { type ReactNode } from "react";

import type { ConvexAuthState, ConvexAuthUserState } from "convex-auth-react/client";
import {
  AuthRuntimeProvider,
  ConvexAuthIdentityProvisioner,
  getConvexAuthActions,
  useAuthState,
  useConvexAuthClientContext,
  useConvexAuthUser,
  useGuardedProtectedWrite,
} from "convex-auth-react/client";
import { DEFAULT_AUTH_RUNTIME_STATUS } from "convex-auth-react/client";
import type { NativeAuthActions } from "convex-auth-react/client";

import { ExpoConvexAuthClientProvider } from "./convex-auth-client-provider";
import type { ExpoConvexAuthStorage } from "./ConvexAuthProvider";

type ConvexAuthRuntimeCreateArgs = {
  actions: NativeAuthActions;
  storage: ExpoConvexAuthStorage;
  signInPath: string;
  signUpPath: string;
};

type ConvexAuthConvexIdentityProvisionerProps = {
  auth: ConvexAuthState;
  getCurrentUser: FunctionReference<"query", "public", Record<string, never>, unknown>;
  provisionCurrentUser: FunctionReference<"mutation", "public", Record<string, never>, unknown>;
};

export type ConvexAuthRuntimeConvexIdentityProvisionerProps = Omit<
  ConvexAuthConvexIdentityProvisionerProps,
  "auth"
>;

export function createExpoConvexAuthRuntime(args: ConvexAuthRuntimeCreateArgs) {
  function useAuth() {
    const authClient = useConvexAuthClientContext();
    return useAuthState(authClient);
  }

  function useUser(): ConvexAuthUserState {
    const authClient = useConvexAuthClientContext();
    return useConvexAuthUser(authClient);
  }

  function useAuthActions() {
    const authClient = useConvexAuthClientContext();
    return getConvexAuthActions({
      authClient,
      signInPath: args.signInPath,
      signUpPath: args.signUpPath,
    });
  }

  function RuntimeProvider(props: { children: ReactNode; identityProvisioner?: ReactNode }) {
    return (
      <ExpoConvexAuthClientProvider actions={args.actions} storage={args.storage}>
        <AuthRuntimeProvider status={DEFAULT_AUTH_RUNTIME_STATUS}>
          {props.identityProvisioner}
          {props.children}
        </AuthRuntimeProvider>
      </ExpoConvexAuthClientProvider>
    );
  }

  function ConvexIdentityProvisioner(props: ConvexAuthRuntimeConvexIdentityProvisionerProps) {
    const auth = useAuth();
    const currentUser = useQuery(props.getCurrentUser, auth.isSignedIn ? {} : "skip");
    const provisionCurrentUser = useGuardedProtectedWrite(useMutation(props.provisionCurrentUser));
    const authClient = useConvexAuthClientContext();
    const session = authClient?.useSession();

    return (
      <ConvexAuthIdentityProvisioner
        auth={auth}
        currentUser={currentUser}
        provisionCurrentUser={async () => await provisionCurrentUser({})}
        sessionSubject={session?.data?.user.id ?? null}
      />
    );
  }

  function SignedIn(props: { children: ReactNode }) {
    const auth = useAuth();
    if (!auth.isSignedIn) {
      return null;
    }
    return <>{props.children}</>;
  }

  function SignedOut(props: { children: ReactNode }) {
    const auth = useAuth();
    if (auth.isSignedIn) {
      return null;
    }
    return <>{props.children}</>;
  }

  return {
    AuthRuntimeProvider: RuntimeProvider,
    ConvexIdentityProvisioner,
    SignedIn,
    SignedOut,
    actions: args.actions,
    storage: args.storage,
    useAppAuth: useAuth,
    useAppAuthActions: useAuthActions,
    useAppUser: useUser,
  };
}
