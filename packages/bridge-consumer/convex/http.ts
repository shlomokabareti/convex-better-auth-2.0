import type { FunctionReference, GenericDataModel } from "convex/server";
import { httpRouter, makeFunctionReference } from "convex/server";
import { createClient } from "convex-better-auth-adapter";
import type { BetterAuthComponentApi } from "convex-better-auth/convex";
import { createBetterAuthConvexRuntime } from "convex-better-auth/convex";
import { createConvexAuthConfig } from "convex-better-auth/server";

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

const authProvider = createConvexAuthConfig();
const authComponent = createClient(dummyComponent);

const { registerRoutes } = createBetterAuthConvexRuntime({
  components: { betterAuth: dummyComponent },
  authProvider,
  authComponent,
});

const http = httpRouter();
registerRoutes(http);

export default http;
