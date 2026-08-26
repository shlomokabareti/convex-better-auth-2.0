import type { FunctionReference, GenericDataModel, GenericQueryCtx } from "convex/server";
import { ConvexError } from "convex/values";

import { sessionRequiredDecision } from "../authorization";
import { sessionIdFromConvexIdentity } from "../principal/assembleViewerContext";
import type { ConvexUserIdentity } from "../principal/resolveConvexUserContext";

/**
 * Require that a given Convex identity carries a sessionId that matches
 * the stored local identity record (Layer 1 session invalidation).
 *
 * This is the baseline check. For sensitive paths, also validate
 * against the Better Auth session table (Layer 2).
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
 * the stored local identity record AND that the Better Auth session record
 * still exists and has not expired (Layer 2 session invalidation).
 *
 * @param lookupActiveSession - app-provided adapter that queries
 *   the Better Auth session model. Return `true` if the session exists
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

/**
 * Build a session existence lookup against the Better Auth adapter component.
 *
 * Example usage from an app with the Better Auth component registered:
 *
 * ```ts
 * import { buildBetterAuthSessionLookup } from "convex-auth/convex";
 *
 * const identity = await ctx.auth.getUserIdentity();
 * const localIdentity = await findIdentityByTokenIdentifier(ctx, identity.tokenIdentifier);
 * const lookup = buildBetterAuthSessionLookup({ ctx, components, identity, localIdentity });
 * await requireActiveSession(identity, localIdentity, lookup);
 * ```
 */
export function buildBetterAuthSessionLookup(args: {
  ctx: { runQuery: GenericQueryCtx<GenericDataModel>["runQuery"] };
  components: {
    betterAuth: {
      adapter: { findOne: FunctionReference<"query", "public" | "internal"> };
    };
  };
  identity: ConvexUserIdentity;
  localIdentity: { sessionId: string | null; userId: string };
  /**
   * Optional org session max age (VOR-183). When set, sessions older than
   * this many minutes (from Better Auth session `createdAt`) fail Layer 2.
   */
  sessionTimeoutMinutes?: number;
  now?: number;
}): () => Promise<boolean> {
  return async () => {
    const sessionId = sessionIdFromConvexIdentity(args.identity);
    if (sessionId === null) {
      return false;
    }

    const session = await args.ctx.runQuery(args.components.betterAuth.adapter.findOne, {
      model: "session",
      where: [
        { field: "_id", value: sessionId },
        { field: "userId", value: args.identity.subject },
        { field: "expiresAt", operator: "gt", value: Date.now() },
      ],
    });

    if (session === null) {
      return false;
    }

    const timeoutMinutes = args.sessionTimeoutMinutes;
    if (timeoutMinutes === undefined) {
      return true;
    }

    const createdAt = readSessionCreatedAt(session);
    if (createdAt === null) {
      return false;
    }
    const now = args.now ?? Date.now();
    return now - createdAt <= timeoutMinutes * 60_000;
  };
}

function readSessionCreatedAt(session: unknown): number | null {
  if (!session || typeof session !== "object") {
    return null;
  }
  if (!("createdAt" in session)) {
    return null;
  }
  const value = session.createdAt;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return null;
}
