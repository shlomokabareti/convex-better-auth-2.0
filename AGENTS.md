# Agent notes — convex-better-auth-2.0

## Verification commands

Run from the repo root:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
```

For Convex package component typechecking, the build also runs `tsc -p tsconfig.component.json` under `packages/auth`.

## Deploying the conformance consumer

```bash
cd packages/conformance-consumer
CONVEX_DEPLOYMENT=fast-gopher-450 pnpm dlx convex dev --once
```

Live deployment: `https://fast-gopher-450.convex.cloud`
Dashboard: `https://dashboard.convex.dev/t/shlomokabareti25/cb-test-2fa-free/fast-gopher-450`

## Convex `HttpRouter` route shape

Convex `HttpRouter` only supports exact `path` matches or trailing `pathPrefix` matches. It does **not** support Express-style named parameters (`/:token`, `/:provider`). Any route that needs a dynamic segment must use `pathPrefix` ending in `/` and extract the segment from `new URL(request.url).pathname`.

This is enforced by the router implementation in `convex/src/server/router.ts`.

## Consumer wiring

The canonical consumer entrypoints are:

- `convex/auth.ts` — call `convexAuth({ component, emailAndPassword, oauth })`, export the `auth` object and the action references.
- `convex/http.ts` — import `auth` from `./auth` and call `auth.addHttpRoutes(http)`. Do not call the lower-level `addNativeAuthHttpRoutes` directly unless you only want email/password.

See `packages/conformance-consumer/convex/auth.ts` and `packages/conformance-consumer/convex/http.ts` for a working example.

## Runtime portability

- No `"use node"` directive in deployed source.
- No `node:` imports in the deployed Convex path.
- No `react-dom/server` in deployed source.
- Use Web Crypto (`globalThis.crypto.subtle`, `crypto.getRandomValues`) for hashing and randomness.
- Avoid `atob`/`btoa` in runtime code; use the `bytesToBase64url`/`base64urlToBytes` helpers in `packages/auth/src/convex-runtime/native/password.ts`.
