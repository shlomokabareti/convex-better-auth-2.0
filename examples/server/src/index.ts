import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ConvexHttpClient } from "convex/browser";
import { FunctionReference } from "convex/server";
import type { NativeAuthActions } from "convex-auth/react";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.CONVEX_URL;
if (convexUrl === undefined || convexUrl.length === 0) {
  throw new Error("CONVEX_URL is not set");
}

const app = new Hono();
const convex = new ConvexHttpClient(convexUrl);

type OAuthStartRef = FunctionReference<
  "action",
  "public",
  { provider: string; callbackURL?: string; errorURL?: string },
  { url: string }
>;

type AuthApi = NativeAuthActions & { signInWithRedirect: OAuthStartRef };

const auth = api.auth as unknown as AuthApi;

app.get("/", (c) => c.json({ ok: true, message: "convex-auth server example" }));

app.post("/auth/sign-up", async (c) => {
  const { name, email, password } = await c.req.json<{
    name: string;
    email: string;
    password: string;
  }>();
  const session = await convex.action(auth.signUp, { name, email, password });
  return c.json(session);
});

app.post("/auth/sign-in", async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const session = await convex.action(auth.signIn, { email, password });
  return c.json(session);
});

app.post("/auth/oauth/:provider", async (c) => {
  const provider = c.req.param("provider");
  const { callbackURL, errorURL } = await c.req.json<{ callbackURL?: string; errorURL?: string }>();
  const { url } = await convex.action(auth.signInWithRedirect, {
    provider,
    callbackURL,
    errorURL,
  });
  return c.json({ url });
});

app.post("/auth/sign-out", async (c) => {
  const { token, callbackURL } = await c.req.json<{ token: string; callbackURL?: string }>();
  const result = await convex.action(auth.signOut, { token, callbackURL });
  return c.json(result);
});

const port = Number(process.env.PORT ?? "3000");

serve({
  fetch: app.fetch,
  port,
});
