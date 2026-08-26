import { v } from "convex/values";

import { query } from "./_generated/server.js";

export const get = query({
  args: {},
  returns: v.object({
    component: v.literal("vortexAuth"),
    schemaVersion: v.number(),
  }),
  handler: async () =>
    ({
      component: "vortexAuth",
      schemaVersion: 1,
    }) as const,
});
