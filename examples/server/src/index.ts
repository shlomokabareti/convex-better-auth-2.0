import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.CONVEX_URL;
if (convexUrl === undefined || convexUrl.length === 0) {
  throw new Error("CONVEX_URL is not set");
}

const app = new Hono();
const convex = new ConvexHttpClient(convexUrl);

const signInWithRedirect = api.auth.signInWithRedirect;
if (signInWithRedirect === undefined) {
  throw new Error("OAuth is not configured in convex/auth.ts");
}

app.get("/", (c) => c.json({ ok: true, message: "convex-auth server example" }));

function errorReason(err: unknown) {
  if (!(err instanceof Error)) return "unknown";
  const match = err.message.match(/(?:Uncaught )?Error: (.+?)(?:\n|$)/);
  return match ? match[1].trim() : err.message;
}

function errorResponse(err: unknown, status: 400 | 401) {
  return { body: { success: false, reason: errorReason(err) } as const, status };
}

app.post("/auth/sign-up", async (c) => {
  try {
    const { name, email, password } = await c.req.json<{
      name: string;
      email: string;
      password: string;
    }>();
    if (!name || !email || !password) {
      return c.json({ success: false, reason: "missing_fields" }, 400);
    }
    const session = await convex.action(api.auth.signUp, { name, email, password });
    return c.json(session);
  } catch (err) {
    const { body, status } = errorResponse(err, 400);
    return c.json(body, status);
  }
});

app.post("/auth/sign-in", async (c) => {
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    if (!email || !password) {
      return c.json({ success: false, reason: "missing_fields" }, 400);
    }
    const session = await convex.action(api.auth.signIn, { email, password });
    return c.json(session);
  } catch (err) {
    const { body, status } = errorResponse(err, 401);
    return c.json(body, status);
  }
});

app.post("/auth/oauth/:provider", async (c) => {
  try {
    const provider = c.req.param("provider");
    const { callbackURL, errorURL } = await c.req.json<{
      callbackURL?: string;
      errorURL?: string;
    }>();
    const { url } = await convex.action(signInWithRedirect, {
      provider,
      callbackURL,
      errorURL,
    });
    return c.json({ url });
  } catch (err) {
    const { body, status } = errorResponse(err, 400);
    return c.json(body, status);
  }
});

app.post("/auth/sign-out", async (c) => {
  try {
    const { token, callbackURL } = await c.req.json<{ token: string; callbackURL?: string }>();
    if (!token) {
      return c.json({ success: false, reason: "missing_token" }, 400);
    }
    const result = await convex.action(api.auth.signOut, { token, callbackURL });
    return c.json(result);
  } catch (err) {
    const { body, status } = errorResponse(err, 401);
    return c.json(body, status);
  }
});

const port = Number(process.env.PORT ?? "3000");

serve({
  fetch: app.fetch,
  port,
});
