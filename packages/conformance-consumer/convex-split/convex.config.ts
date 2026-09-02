import { defineApp } from "convex/server";
import { v } from "convex/values";
import authCore from "convex-auth/convex.config/core";
import authOrganizations from "convex-auth/convex.config/organizations";
import authApiKeys from "convex-auth/convex.config/apiKeys";

const app = defineApp({
  env: {
    JWT_PRIVATE_KEY: v.string(),
    JWKS: v.string(),
  },
});

app.use(authCore, {
  env: {
    JWT_PRIVATE_KEY: app.env.JWT_PRIVATE_KEY,
    JWKS: app.env.JWKS,
  },
});

app.use(authOrganizations, {
  env: {
    JWT_PRIVATE_KEY: app.env.JWT_PRIVATE_KEY,
    JWKS: app.env.JWKS,
  },
});

app.use(authApiKeys);

export default app;
