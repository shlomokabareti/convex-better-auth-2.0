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

- `convex/convex.config.ts` — `app.use(convexAuth)` so the `convex-auth` component is installed.
- `convex/auth.config.ts` — `export default { providers: [createConvexAuthProvider()] }` so `ctx.auth.getUserIdentity()` works with the native JWTs.
- `convex/auth.ts` — call `convexAuth({ component, emailAndPassword, oauth })`, export the `auth` object and the action references.
- `convex/http.ts` — import `auth` from `./auth` and call `auth.addHttpRoutes(http)`. Do not call the lower-level `addNativeAuthHttpRoutes` directly unless you only want email/password.

See `packages/conformance-consumer/convex/convex.config.ts`, `packages/conformance-consumer/convex/auth.config.ts`, `packages/conformance-consumer/convex/auth.ts`, and `packages/conformance-consumer/convex/http.ts` for a working example.

## Runtime portability

- No `"use node"` directive in deployed source.
- No `node:` imports in the deployed Convex path.
- No `react-dom/server` in deployed source.
- Use Web Crypto (`globalThis.crypto.subtle`, `crypto.getRandomValues`) for hashing and randomness.
- Avoid `atob`/`btoa` in runtime code; use the `bytesToBase64url`/`base64urlToBytes` helpers in `packages/auth/src/convex-runtime/native/password.ts`.

## Branch and PR workflow

This repo does not use Graphite. Use `gh` and `git` directly:

- Create branches with `git checkout -b <branch>`.
- Open PRs with `gh pr create`.
- Rebase and force push with `git rebase` and `git push --force-with-lease` when needed.
- Merge with `gh pr merge`.
- For stacked PRs, use GitHub stacked PRs (branches targeting the parent branch, e.g. `feature-b` based on `feature-a` with PR target `feature-a`).

After push, use `gh pr checks` and `gh run list` to verify. Do not run `gh run watch`, `sleep`, or any wait/poll loop on CI. If a check has already failed, fetch the failure once and fix; otherwise move on.
