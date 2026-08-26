import {
  extractAuthorizationDeniedAuditPayload,
  type AuthorizationDeniedAuditPayload,
} from "./authorizationDeniedPayload";

/**
 * Increment 4a — the denial-audit emitter.
 *
 * Every B2B consumer otherwise hand-writes the same authorization-denial
 * plumbing twice: once in the `onAuthorizationDenied` hook of
 * `createConvexAuthFunctions` (factory-gated checks) and once in its manual
 * `require*Permission` helpers (hand-called checks) — and must keep the two
 * emissions in lockstep or its audit trail drifts.
 *
 * This bakes the consumer's `emit` sink + `deriveContext` projection ONCE and
 * returns BOTH paths, each routing through the SAME `emitDenial`. By
 * construction the factory hook and the manual path emit the identical event
 * for the same denial — they cannot drift. The package owns the error→payload
 * extraction (via {@link extractAuthorizationDeniedAuditPayload}); the consumer
 * supplies only where to emit and how to read its own context (ids + flags) off
 * the resolved viewer.
 */

export type AuthorizationDenialAuditEvent<TContext> = {
  /** The required permission for a gated check, or null (authed-only / resolution failure). */
  permission: string | null;
  /**
   * The package-extracted denial payload, or null when the thrown error carried
   * no structured denial data (e.g. resolution failed before an authz error was
   * shaped). `emit` still fires so the denial is never silently dropped.
   */
  payload: AuthorizationDeniedAuditPayload | null;
  /** Consumer-derived context (ids + flags) for this denial. `undefined` if no `deriveContext`. */
  context: TContext | undefined;
  /** The original thrown error, for the consumer to inspect if it needs more. */
  error: unknown;
};

export type AuthorizationDenialAuditorArgs<TViewer> = {
  permission?: string;
  error: unknown;
  viewer?: TViewer | null;
};

export type DeriveAuthorizationDenialContextArgs<TViewer, TCtx> = {
  viewer: TViewer | null;
  ctx: TCtx;
  error: unknown;
};

export type CreateAuthorizationDenialAuditorConfig<TViewer, TCtx, TContext> = {
  /** Where to emit a denial audit event (e.g. structured logger write + flush). */
  emit: (
    event: AuthorizationDenialAuditEvent<TContext>
  ) => Promise<void> | void;
  /**
   * Project the consumer's own context (user/org ids, presence flags, …) off the
   * resolved viewer + ctx. Omit when the package payload is enough; `context`
   * is then `undefined`.
   */
  deriveContext?: (
    args: DeriveAuthorizationDenialContextArgs<TViewer, TCtx>
  ) => TContext | Promise<TContext>;
};

export type AuthorizationDenialAuditor<TViewer, TCtx> = {
  /**
   * Drop-in for `createConvexAuthFunctions({ onAuthorizationDenied })`. Emits the
   * denial audit. Does NOT throw — the factory re-throws the original error after
   * the hook runs.
   */
  onAuthorizationDenied: (
    ctx: TCtx,
    args: AuthorizationDenialAuditorArgs<TViewer>
  ) => Promise<void>;
  /**
   * The manual path: emit the SAME denial audit, then re-throw the original
   * error. Use in hand-called permission checks so they never drift from the
   * factory hook.
   */
  auditAndRethrow: (
    ctx: TCtx,
    args: AuthorizationDenialAuditorArgs<TViewer>
  ) => Promise<never>;
};

export function createAuthorizationDenialAuditor<
  TViewer,
  TCtx,
  TContext = undefined,
>(
  config: CreateAuthorizationDenialAuditorConfig<TViewer, TCtx, TContext>
): AuthorizationDenialAuditor<TViewer, TCtx> {
  async function emitDenial(
    ctx: TCtx,
    args: AuthorizationDenialAuditorArgs<TViewer>
  ): Promise<void> {
    const payload = extractAuthorizationDeniedAuditPayload(args.error);
    const viewer = args.viewer ?? null;
    const context =
      config.deriveContext === undefined
        ? undefined
        : await config.deriveContext({ viewer, ctx, error: args.error });

    await config.emit({
      permission: args.permission ?? payload?.permission ?? null,
      payload,
      context,
      error: args.error,
    });
  }

  return {
    onAuthorizationDenied: (ctx, args) => emitDenial(ctx, args),
    auditAndRethrow: async (ctx, args) => {
      await emitDenial(ctx, args);
      throw args.error;
    },
  };
}
