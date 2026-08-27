import { ConvexBetterAuthProvider, type AuthClient } from "convex-better-auth-adapter/react";
import type { ReactNode } from "react";

type ConvexClientLike = {
  setAuth(fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>): void;
  clearAuth(): void;
};

export function BetterAuthConvexProvider(args: {
  children: ReactNode;
  client: ConvexClientLike;
  authClient: unknown;
  initialToken?: string | null;
}) {
  if (!isAuthClient(args.authClient)) {
    throw new TypeError(
      "BetterAuthConvexProvider requires a Better Auth client with session and Convex token methods",
    );
  }
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

function isAuthClient(value: unknown): value is AuthClient {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return false;
  }
  const convex = Reflect.get(value, "convex");
  return (
    typeof Reflect.get(value, "useSession") === "function" &&
    typeof Reflect.get(value, "getSession") === "function" &&
    (typeof convex === "object" || typeof convex === "function") &&
    convex !== null &&
    typeof Reflect.get(convex, "token") === "function"
  );
}
