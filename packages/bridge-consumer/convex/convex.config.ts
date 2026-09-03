import { defineApp } from "convex/server";
import betterAuth from "convex-better-auth-adapter/convex.config";

const app = defineApp();
app.use(betterAuth);

export default app;
