import { defineComponent } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const component = defineComponent("convexAuthOrganizations", {
  env: {
    JWT_PRIVATE_KEY: v.string(),
    JWKS: v.string(),
  },
});

component.use(rateLimiter, { name: "rateLimiter" });

export default component;
