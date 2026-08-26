/**
 * Compile-time contract: the real Better Auth client factory's return
 * type MUST stay assignable to ConvexBetterAuthClient.
 *
 * Every consumer (pile, CRM, plasma) writes exactly this cast:
 *
 *   const c: ConvexBetterAuthClient | null = createBetterAuthConvexClient({...});
 *
 * When the package's ConvexBetterAuthClient drifts so the real client no
 * longer fits — e.g. an over-narrow `signIn.email` response type, which
 * is precisely what slipped through in the 2FA work and only surfaced in
 * pile's typecheck — the assignment below stops compiling. That moves the
 * failure into THIS package's CI instead of a downstream consumer's.
 *
 * The binding is type-level only and never invokes the factory (no
 * network / no `window`); `bun test` just confirms it linked.
 */
import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { createBetterAuthConvexClient } from "./better-auth-client";
import type { ConvexBetterAuthClient } from "./react";

type RealConvexClient = ReturnType<typeof createBetterAuthConvexClient>;

// If RealConvexClient is not assignable to ConvexBetterAuthClient, this
// declaration fails to typecheck — the whole point of the contract.
const clientAssignableToConvex: (client: RealConvexClient) => ConvexBetterAuthClient = (client) =>
  client;

describe("Better Auth client ↔ ConvexBetterAuthClient contract", () => {
  it("real createBetterAuthConvexClient return type is assignable to ConvexBetterAuthClient", () => {
    assert.equal(typeof clientAssignableToConvex, "function");
  });
});
