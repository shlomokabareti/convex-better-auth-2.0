/**
 * Scopes that no issued credential may ever hold.
 *
 * A key that can mint keys self-replicates: one leaked credential mints a
 * sibling, the sibling mints another, and revoking the original recovers
 * nothing. The blast radius of a leak stops being "what that key could do" and
 * becomes "everything, forever".
 *
 * The defence has to live at issuance, not at the route. convex-payments closed
 * its own instance of this by deleting the mint route outright (#132), but a
 * deleted route is a per-consumer fix that the next consumer will not inherit,
 * and re-adding the route silently restores the hole. Refusing the scope at the
 * only layer that mints anything makes it structural for every consumer.
 *
 * Polar enforces the same property twice and independently: `SCOPES_SUPPORTED`
 * omits `organization_access_tokens:read|write` entirely, so a token cannot hold
 * the scope that mints tokens, AND the mint endpoint additionally requires a web
 * user session. This constant is the first half. Issuance is reachable only
 * through internal mutations (deployment-admin) or an authenticated session,
 * which is the second.
 *
 * Adding a scope here is a security decision, not a config change: it must be a
 * scope whose whole purpose is granting authority to other credentials.
 */
export const NEVER_ISSUABLE_SCOPES: readonly string[] = [
  "auth:api-keys:issue",
  "auth:api-keys:revoke",
  "auth:service-principals:write",
];

/**
 * Throws if any requested scope is one that may never be granted.
 *
 * Deliberately loud and specific: unlike a verification failure -- where a
 * distinguishable reason hands an attacker an enumeration oracle -- this is a
 * developer-facing programming error at issuance time, and naming the offending
 * scope is what makes it fixable.
 */
export function assertScopesAreIssuable(
  scopes: readonly string[] | undefined
): void {
  if (scopes === undefined) {
    return;
  }
  const forbidden = scopes.filter((scope) =>
    NEVER_ISSUABLE_SCOPES.includes(scope)
  );
  if (forbidden.length > 0) {
    throw new Error(
      `Refusing to issue a credential holding never issuable scope(s): ${forbidden.join(", ")}. A credential that can mint credentials self-replicates, so a single leak becomes unrecoverable. Issue this capability through a session-authenticated path instead.`
    );
  }
}
