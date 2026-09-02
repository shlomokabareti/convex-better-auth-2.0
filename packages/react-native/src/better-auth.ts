/**
 * Legacy Better Auth / Expo compatibility surface.
 *
 * Consumers still on the Better Auth runtime can import from
 * `convex-auth-react-native/better-auth` while they migrate to the native
 * `convex-auth-react-native` entry.
 */
export * from "./client";
export * from "./config";
export * from "./hosted";
export * from "./invite-flow";
export * from "./provider";
export * from "./readiness";
export * from "./runtime";
export * from "./session-restore";
