import { defineComponent } from "convex/server";
import { v } from "convex/values";
import core from "../core/convex.config.js";

const organizations = defineComponent("convexAuthOrganizations", {
  env: {
    JWT_PRIVATE_KEY: v.string(),
    JWKS: v.string(),
  },
});

organizations.use(core, {
  name: "core",
  env: {
    JWT_PRIVATE_KEY: organizations.env.JWT_PRIVATE_KEY,
    JWKS: organizations.env.JWKS,
  },
});

export default organizations;
