# OAuth

`convex-auth` supports Google, GitHub, and Discord OAuth out of the box. The OAuth flow uses server-side state and PKCE. The browser is redirected through the provider and then back to your `CONVEX_SITE_URL`, which validates the callback and redirects the user to your `callbackURL`.

## Configure providers in `convex/auth.ts`

```ts
import { components } from "./_generated/api";
import { convexAuth } from "convex-auth/convex";

export const auth = convexAuth({
  component: components.convexAuth,
  emailAndPassword: { enabled: true },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    },
  },
});
```

## Set provider credentials

```bash
convex env set GOOGLE_CLIENT_ID '...'
convex env set GOOGLE_CLIENT_SECRET '...'
convex env set GITHUB_CLIENT_ID '...'
convex env set GITHUB_CLIENT_SECRET '...'
convex env set DISCORD_CLIENT_ID '...'
convex env set DISCORD_CLIENT_SECRET '...'
```

## Start the OAuth flow from React

Use the `signInWithRedirect` action from `api.auth`:

```tsx
import { useAction } from "convex/react";

function OAuthButtons() {
  const start = useAction(api.auth.signInWithRedirect);

  const startOAuth = async (provider: "google" | "github" | "discord") => {
    const { url } = await start({
      provider,
      callbackURL: `${window.location.origin}/auth/callback`,
      errorURL: `${window.location.origin}/auth/error`,
    });
    window.location.href = url;
  };

  return (
    <>
      <button onClick={() => startOAuth("google")}>Sign in with Google</button>
      <button onClick={() => startOAuth("github")}>Sign in with GitHub</button>
      <button onClick={() => startOAuth("discord")}>Sign in with Discord</button>
    </>
  );
}
```

`signInWithRedirect` returns a `{ url }` object. Redirect the browser to that URL. From a server, call the action and redirect the browser to the returned URL yourself.

## Callback handling

Convex already exposes the callback at `/api/auth/callback/:provider` through `auth.addHttpRoutes(http)`. The provider redirects there, the token is issued, and the browser is redirected to `callbackURL` with `?token=...&sessionId=...`.

Your frontend should read the token from the query string and pass it to the provider:

```tsx
import { useEffect } from "react";
import { useAuthActions } from "convex-auth/react";

function OAuthCallback() {
  const { updateSession } = useAuthActions();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      void updateSession({ token });
    }
  }, [updateSession]);

  return <p>Finishing sign-in...</p>;
}
```

## Server-side OAuth

From a Hono server:

```ts
import { Hono } from "hono";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);
const app = new Hono();

app.post("/auth/oauth/:provider", async (c) => {
  const provider = c.req.param("provider");
  const { url } = await convex.action(api.auth.signInWithRedirect, {
    provider,
    callbackURL: `${process.env.APP_URL}/auth/callback`,
  });
  return c.json({ url });
});
```
