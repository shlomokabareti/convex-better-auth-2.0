import { ConvexError } from "convex/values";

import { sessionRequiredDecision } from "../authorization";
import { sessionIdFromConvexIdentity } from "../principal/assembleViewerContext";
import type { ConvexUserIdentity } from "../principal/resolveConvexUserContext";

/**
 * Require that a given Convex identity carries a sessionId that matches
 * the stored local identity record (Layer 1 session invalidation).
 *
 * This is the baseline check. For sensitive paths, also validate
 * against the upstream session provider (Layer 2).
 */
export function requireLocalSessionValid(
  identity: ConvexUserIdentity,
  localIdentity: { sessionId: string | null },
): void {
  const sessionId = sessionIdFromConvexIdentity(identity);

  if (sessionId === null || localIdentity.sessionId !== sessionId) {
    const decision = sessionRequiredDecision();
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: decision.reason ?? "Active session required",
      authzCode: decision.code,
    });
  }
}

/**
 * Require that a given Convex identity carries a sessionId that matches
 * the stored local identity record AND that the upstream session record
 * still exists and has not expired (Layer 2 session invalidation).
 *
 * @param lookupActiveSession - app-provided adapter that queries
 *   the upstream session model. Return `true` if the session exists
 *   and is not expired, `false` otherwise.
 */
export async function requireActiveSession(
  identity: ConvexUserIdentity,
  localIdentity: { sessionId: string | null },
  lookupActiveSession: () => Promise<boolean>,
): Promise<void> {
  requireLocalSessionValid(identity, localIdentity);
  const isActive = await lookupActiveSession();
  if (!isActive) {
    const decision = sessionRequiredDecision();
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: decision.reason ?? "Active session required",
      authzCode: decision.code,
    });
  }
}
