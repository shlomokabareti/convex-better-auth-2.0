/**
 * Service session (agent-as-user / impersonation).
 *
 * "Impersonation" is just: mint a valid session AS a target user. Better-Auth's
 * `admin` plugin does this — but it drags in a parallel global-authority model
 * (`user.role`, ban machinery) that competes with our org RBAC, plus a strict
 * component-schema migration we don't control. We don't use it.
 *
 * Instead we call Better-Auth's OWN session-creation primitive directly —
 * `internalAdapter.createSession(userId)` (the same call a dozen core plugins,
 * and the admin plugin's `impersonateUser`, use under the hood). We deliberately
 * pass NO `impersonatedBy` override, so the write fits the default component
 * session schema with no migration. The acting principal is recorded in OUR
 * audit layer instead of Better-Auth's `session.impersonatedBy` column.
 *
 * This is the HIGHEST-RISK surface in the package (a password-less session mint),
 * so the dangerous capability is baked behind two non-optional seams:
 *   - `authorize` — resolves + authorizes the ACTING principal. It MUST throw to
 *     deny; the mint is unreachable unless it returns. Gate by YOUR model (a
 *     service principal / `requirePermission("sessions:impersonate")`), never a
 *     shared secret, never a Better-Auth admin role.
 *   - `audit` — fires on every successful mint with the principal + target. If it
 *     throws, the just-minted session is REVOKED before the error propagates, so
 *     no unaudited session can survive.
 *
 * Usage (consumer wires its RBAC + audit once):
 *
 *   const { mintServiceSession } = createAuthServiceSessionMinter({
 *     createAuth,
 *     authorize: async (ctx, req) => {
 *       const viewer = await canonicalAuth.resolveViewer(ctx);
 *       viewer.requirePermission("sessions:impersonate"); // throws to deny
 *       return { actorUserId: String(viewer.user._id) };
 *     },
 *     audit: (ctx, e) => ctx.runMutation(internal.audit.recordServiceSessionMint, {
 *       actorUserId: e.principal.actorUserId, targetUserId: e.request.targetUserId,
 *       reason: e.request.reason,
 *     }),
 *   });
 */

export type ServiceSessionMintRequest = {
  /** The user the minted session authenticates as. */
  targetUserId: string;
  /** Free-form reason recorded in the audit event (e.g. the agent run id). */
  reason?: string;
  /** Better-Auth `dontRememberMe`. Defaults to `true` (shorter-lived service session). */
  dontRememberMe?: boolean;
};

export type ServiceSessionResult = {
  /**
   * The Better-Auth session token. Exchange it for a Convex JWT by GETting
   * `/api/auth/convex/token` with an `Authorization: Bearer <token>` header
   * (the @convex-dev/better-auth convex plugin embeds Better-Auth's bearer
   * hooks, which self-sign this raw token into the session cookie the token
   * endpoint reads). This is a CREDENTIAL — treat it like a password.
   */
  token: string;
  /** Session expiry, epoch millis, when Better-Auth returns one. */
  expiresAt?: number;
};

export type ServiceSessionMintAudit<TPrincipal> = {
  /** Whatever `authorize` returned — the authenticated ACTING principal. */
  principal: TPrincipal;
  request: ServiceSessionMintRequest;
  /**
   * NON-SECRET result metadata only. The session TOKEN is deliberately OMITTED:
   * a consumer's `audit` typically PERSISTS this event, and a stored bearer token
   * is a replayable credential — anyone with audit-log read access could then
   * authenticate as the target until expiry. Audit records the WHO/WHAT/WHEN, not
   * the credential.
   */
  result: { expiresAt?: number };
};

export type CreateAuthServiceSessionMinterConfig<TCtx, TPrincipal> = {
  /** The runtime's `createAuth` — its `$context` exposes Better-Auth's `internalAdapter`. */
  createAuth: (ctx: TCtx) => { $context: Promise<unknown> };
  /**
   * Authorize the ACTING principal for this mint. MUST throw to deny — the mint
   * is unreachable unless this resolves. Baked: the gate cannot be skipped at a
   * call site.
   */
  authorize: (
    ctx: TCtx,
    request: ServiceSessionMintRequest
  ) => Promise<TPrincipal> | TPrincipal;
  /**
   * Record every successful mint (acting principal + target + reason). Baked. If
   * it throws, the minted session is revoked before the error propagates.
   */
  audit: (
    ctx: TCtx,
    event: ServiceSessionMintAudit<TPrincipal>
  ) => Promise<void> | void;
};

type InternalAdapterLike = {
  createSession: (
    userId: string,
    dontRememberMe?: boolean,
    override?: Record<string, unknown>,
    overrideAll?: boolean
  ) => Promise<{ token: string; expiresAt?: number | Date }>;
  deleteSession: (token: string) => Promise<unknown>;
  /** Resolves the target user, or null if no such user exists. */
  findUserById: (userId: string) => Promise<unknown>;
};

function requireInternalAdapter(value: unknown): InternalAdapterLike {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Better Auth returned an invalid context");
  }
  const adapter = Reflect.get(value, "internalAdapter");
  if (typeof adapter !== "object" || adapter === null) {
    throw new TypeError("Better Auth context is missing internalAdapter");
  }
  const call = (name: string, args: unknown[]): unknown => {
    const method = Reflect.get(adapter, name);
    if (typeof method !== "function") {
      throw new TypeError(`Better Auth internalAdapter.${name} is required`);
    }
    return Reflect.apply(method, adapter, args);
  };
  return {
    createSession: async (...args) => {
      const result: unknown = await call("createSession", args);
      if (typeof result !== "object" || result === null) {
        throw new TypeError("Better Auth createSession returned invalid data");
      }
      const token = Reflect.get(result, "token");
      const expiresAt = Reflect.get(result, "expiresAt");
      if (
        typeof token !== "string" ||
        (expiresAt !== undefined &&
          typeof expiresAt !== "number" &&
          !(expiresAt instanceof Date))
      ) {
        throw new TypeError("Better Auth createSession returned invalid data");
      }
      return { token, ...(expiresAt !== undefined ? { expiresAt } : {}) };
    },
    deleteSession: async (token) => await call("deleteSession", [token]),
    findUserById: async (userId) => await call("findUserById", [userId]),
  };
}

export function createAuthServiceSessionMinter<TCtx, TPrincipal>(
  config: CreateAuthServiceSessionMinterConfig<TCtx, TPrincipal>
): {
  mintServiceSession: (
    ctx: TCtx,
    request: ServiceSessionMintRequest
  ) => Promise<ServiceSessionResult>;
} {
  return {
    mintServiceSession: async (ctx, request) => {
      if (
        typeof request.targetUserId !== "string" ||
        request.targetUserId.length === 0
      ) {
        throw new Error(
          "createAuthServiceSessionMinter: targetUserId is required."
        );
      }

      // 1. GATE (baked). Throws to deny → everything below is unreachable.
      const principal = await config.authorize(ctx, request);

      const internalAdapter = requireInternalAdapter(
        await config.createAuth(ctx).$context
      );

      // 2. TARGET MUST EXIST. A stale / mistyped targetUserId would otherwise
      //    mint an ORPHAN session (a valid token authenticating as a user that
      //    does not exist) and audit it as a real mint. Better-Auth's own admin
      //    impersonate does this findUserById check first; we match it.
      const targetUser = await internalAdapter.findUserById(
        request.targetUserId
      );
      if (targetUser === null || targetUser === undefined) {
        throw new Error(
          `createAuthServiceSessionMinter: target user not found (${request.targetUserId}).`
        );
      }

      // 2b. TARGET MUST BE ACTIVE. Minting is password-less, so a disabled or
      //     banned account would otherwise be impersonable via this path even
      //     though it can no longer sign in itself. Reject on explicit
      //     disablement (absent flags ⇒ no false positives). The consumer's
      //     `authorize` hook may also enforce this, but the package fails closed.
      const isActive =
        typeof targetUser === "object" && targetUser !== null
          ? Reflect.get(targetUser, "isActive")
          : undefined;
      const banned =
        typeof targetUser === "object" && targetUser !== null
          ? Reflect.get(targetUser, "banned")
          : undefined;
      if (isActive === false || banned === true) {
        throw new Error(
          `createAuthServiceSessionMinter: target user is not active (${request.targetUserId}).`
        );
      }

      // 3. MINT — native Better-Auth session create. No `impersonatedBy`
      //    override, so the default component session schema suffices.
      const session = await internalAdapter.createSession(
        request.targetUserId,
        request.dontRememberMe ?? true
      );
      const result: ServiceSessionResult = {
        token: session.token,
        expiresAt:
          session.expiresAt instanceof Date
            ? session.expiresAt.getTime()
            : session.expiresAt,
      };

      // 4. AUDIT (baked). On failure, REVOKE the session before propagating so no
      //    unaudited session survives. The audit event gets NON-SECRET metadata
      //    only — never the session token (a persisted token would be a
      //    replayable credential in the audit log).
      try {
        await config.audit(ctx, {
          principal,
          request,
          result: { expiresAt: result.expiresAt },
        });
      } catch (auditError) {
        try {
          await internalAdapter.deleteSession(result.token);
        } catch (revokeError) {
          // BOTH audit AND revoke failed → a LIVE, unaudited session now exists.
          // The contract ("no unaudited session can survive") is violated, so we
          // must NOT swallow this: surface both failures so the caller/operator
          // can revoke it out-of-band. Do not pretend revocation succeeded.
          const auditMessage =
            auditError instanceof Error
              ? auditError.message
              : String(auditError);
          const revokeMessage =
            revokeError instanceof Error
              ? revokeError.message
              : String(revokeError);
          throw new Error(
            `createAuthServiceSessionMinter: audit failed AND session revocation failed — a live unaudited session may exist for target ${request.targetUserId} and must be revoked manually. Audit error: ${auditMessage}. Revoke error: ${revokeMessage}.`,
            { cause: revokeError }
          );
        }
        throw auditError;
      }

      return result;
    },
  };
}
