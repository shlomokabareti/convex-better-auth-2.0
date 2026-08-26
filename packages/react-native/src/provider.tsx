import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

export type VortexExpoConvexClientOptions = ConstructorParameters<
  typeof ConvexReactClient
>[1];

export type VortexExpoConvexReactClient = ConvexReactClient;

export function createVortexExpoConvexReactClient(
  convexUrl: string,
  options: VortexExpoConvexClientOptions = {}
): VortexExpoConvexReactClient {
  const url = convexUrl.trim();
  if (!url) {
    throw new Error("EXPO_PUBLIC_CONVEX_URL is required.");
  }

  return new ConvexReactClient(url, {
    expectAuth: true,
    unsavedChangesWarning: false,
    ...options,
  });
}

export function VortexExpoConvexAuthProvider(args: {
  authClient: AuthClient;
  children: ReactNode;
  client: VortexExpoConvexReactClient;
  initialToken?: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      authClient={args.authClient}
      client={args.client}
      initialToken={args.initialToken}
    >
      {args.children}
    </ConvexBetterAuthProvider>
  );
}
