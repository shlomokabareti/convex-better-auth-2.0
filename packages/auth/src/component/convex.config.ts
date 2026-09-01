import { defineComponent } from "convex/server";
import { v } from "convex/values";

export default defineComponent("convexAuth", {
  env: {
    JWT_PRIVATE_KEY: v.string(),
    JWKS: v.string(),
  },
});
