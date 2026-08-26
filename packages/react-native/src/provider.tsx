import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

export type ExpoConvexClientOptions = ConstructorParameters<typeof ConvexReactClient>[1];

export type ExpoConvexReactClient = ConvexReactClient;

export function createExpoConvexReactClient(
  convexUrl: string,
  options: ExpoConvexClientOptions = {},
): ExpoConvexReactClient {
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

export function ExpoConvexAuthProvider(args: {
  authClient: AuthClient;
  children: ReactNode;
  client: ExpoConvexReactClient;
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
