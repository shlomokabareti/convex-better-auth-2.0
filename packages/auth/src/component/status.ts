import { v } from "convex/values";

import { query } from "./_generated/server.js";

export const get = query({
  args: {},
  returns: v.object({
    component: v.literal("convexAuth"),
    schemaVersion: v.number(),
  }),
  handler: async () =>
    ({
      component: "convexAuth",
      schemaVersion: 1,
    }) as const,
});
