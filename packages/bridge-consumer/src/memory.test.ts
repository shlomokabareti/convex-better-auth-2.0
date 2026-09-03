import { describe, expect, it } from "vitest";

import type { FunctionReference, GenericActionCtx, GenericDataModel } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { createClient } from "convex-better-auth-adapter";
import type { BetterAuthComponentApi } from "convex-better-auth/convex";
import { createBetterAuthConvexRuntime } from "convex-better-auth/convex";
import { createConvexAuthConfig } from "convex-better-auth/server";

// 64 MB is the Convex function heap limit. The bridge's lazy Better Auth
// initialization must stay well under that in a fresh isolate.
const MAX_TOTAL_HEAP_BYTES = 64 * 1024 * 1024;
const MAX_DELTA_HEAP_BYTES = 32 * 1024 * 1024;

const internalMutationRef = makeFunctionReference<"mutation">(
  "adapter:create",
) as unknown as FunctionReference<"mutation", "internal">;
const internalQueryRef = makeFunctionReference<"query">(
  "adapter:findOne",
) as unknown as FunctionReference<"query", "internal">;

const dummyComponent = {
  adapter: {
    create: internalMutationRef,
    findOne: internalQueryRef,
    findMany: internalQueryRef,
    updateOne: internalMutationRef,
    incrementOne: internalMutationRef,
    updateMany: internalMutationRef,
    deleteOne: internalMutationRef,
    deleteMany: internalMutationRef,
  },
} satisfies BetterAuthComponentApi<GenericDataModel>;

const dummyCtx = {} as unknown as GenericActionCtx<GenericDataModel>;

function currentHeapBytes(): number {
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage().heapUsed;
}

describe("bridge memory stress", () => {
  it("initializing the Better Auth runtime stays under the Convex heap limit", async () => {
    process.env.BETTER_AUTH_SECRET = "test-secret-".padEnd(32, "x");
    process.env.CONVEX_SITE_URL = "https://example.convex.site";

    const baseline = currentHeapBytes();

    const authProvider = createConvexAuthConfig();
    const authComponent = createClient(dummyComponent);
    const { createAuth } = createBetterAuthConvexRuntime({
      components: { betterAuth: dummyComponent },
      authProvider,
      authComponent,
    });

    const auth = createAuth(dummyCtx);

    try {
      // Force the lazy Better Auth instance to actually build and load
      // better-auth/minimal, better-auth/plugins, and the adapter plugins.
      await auth.$context;
    } catch (error) {
      // The backend context may fail because the dummy component cannot
      // actually talk to Convex, but the runtime must have been initialized
      // (and allocated) by this point. That is what we are measuring.
      if (error === null || typeof error !== "object") {
        throw error;
      }
    }

    const used = currentHeapBytes();
    const delta = used - baseline;

    expect(used).toBeLessThan(MAX_TOTAL_HEAP_BYTES);
    expect(delta).toBeLessThan(MAX_DELTA_HEAP_BYTES);
  });
});
