<div align="center">

# convex-better-auth-2.0

A public, full-stack auth solution that bridges [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

[![CI][ci-badge]][ci]
[![Docs][docs-badge]][docs]
[![License][license-badge]][license]
[![Status][status-badge]][status]
[![Node][node-badge]][node]
[![pnpm][pnpm-badge]][pnpm]

**[Docs](https://gregarious-perch-710.convex.site)** · **[Why this exists](#why-this-exists)** · **[Packages](#packages)** · **[Quick start](#quick-start)**

</div>

---

## Status

Alpha — APIs will change. Packages are published to npm as `0.x.x-alpha.0` pre-releases. Read the [docs](https://gregarious-perch-710.convex.site) for the current design and roadmap.

## Why this exists

Convex is building the future of auth, but it is not there yet. Better Auth has the most complete feature set today, but it is not designed around Convex's component, query, and mutation model. Most teams who try to combine the two end up rewriting the same glue and making the same security mistakes.

This repo is the pragmatic middle path:

1. **Convex Auth 2.0 is still coming.** Until Convex ships a first-class, native auth system, teams need a production-grade option that does not block them.
2. **Better Auth's plugin model and Convex's component system fight each other.** Better Auth assumes it owns the runtime and tables; Convex wants auth inside a versioned component with generated queries and mutations. Without a bridge, the two leak into each other.
3. **Convex should eventually own auth, but not by throwing Better Auth away.** Better Auth already covers password/email flows, OAuth, 2FA, organizations, API keys, webhooks, and more. The right move is to rebuild those plugin features as Convex-style components, queries, mutations, and actions, then replace pieces with native Convex auth as the platform catches up.

Read the full rationale in [`docs/motivation.md`](docs/motivation.md) and the design details in [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md).

## Packages

| Package                    | npm                        | Path                    | Description                                                                                   |
| -------------------------- | -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `convex-auth`              | `convex-auth`              | `packages/auth`         | Convex auth component, control plane, and server integration. This is what most apps install. |
| `convex-better-auth`       | `convex-better-auth`       | `packages/better-auth`  | Better Auth ↔ Convex bridge (runtime + client).                                               |
| `convex-auth-react`        | `convex-auth-react`        | `packages/react`        | React UI and hooks.                                                                           |
| `convex-auth-react-native` | `convex-auth-react-native` | `packages/react-native` | Expo / React Native client.                                                                   |
| `convex-auth-core`         | `convex-auth-core`         | `packages/core`         | Auth domain core (permissions, roles, scopes).                                                |
| `convex-auth-ui`           | `convex-auth-ui`           | `packages/ui`           | Base shadcn-style UI primitives.                                                              |

All packages are independently buildable and published under the Apache-2.0 license.

## Quick start

### Convex component

Use the `convex-auth` component in your `convex/convex.config.ts`:

```ts
import { defineComponents } from "convex/server";
import auth from "convex-auth/component";

export default defineComponents({
  auth,
});
```

Then wire up the auth HTTP and session helpers in `convex/auth.ts` and `convex/http.ts` following the Better Auth + Convex patterns. See [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md) for the full mapping.

### React client

Create an auth client with the Convex plugin:

```ts
import { createAuthClient } from "convex-auth-react";
import { convexClient } from "convex-better-auth-adapter/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

Wrap your app in the provider:

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "convex-auth-react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function App() {
  return (
    <ConvexProvider client={convex}>
      <BetterAuthConvexProvider client={convex} authClient={authClient}>
        {/** your app */}
      </BetterAuthConvexProvider>
    </ConvexProvider>
  );
}
```

## Development

This repo uses pnpm and [Vite+](https://github.com/voidzero-dev/vite_plus) (`vp`) for building, linting, and formatting. Documentation is generated with [Blume](https://useblume.dev) and hosted via [`@convex-dev/static-hosting`](https://github.com/get-convex/static-hosting) from the `site/` workspace.

```bash
pnpm install

pnpm run typecheck   # TypeScript across all packages
pnpm run lint        # Lint
pnpm run build       # Build all packages
pnpm run test        # Run all tests
pnpm run check       # Format + lint check
pnpm run fix         # Auto-fix lint and formatting
```

## CI

A GitHub Actions workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). It runs the full proof (`typecheck`, `check`, `build`, `test`) on Node 20.12+ and Node 22.

## Releasing

Push a `v*` tag or trigger the workflow manually:

```bash
git tag v0.2.0-alpha.0
git push origin v0.2.0-alpha.0
```

The `Release` workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml) builds and publishes every public package to npm. It needs an `NPM_TOKEN` repository secret.

## License

Apache-2.0 — see `LICENSE`.

<!-- badges -->

[ci-badge]: https://img.shields.io/github/actions/workflow/status/shlomokabareti/convex-better-auth-2.0/ci.yml?branch=main&style=for-the-badge&label=CI
[ci]: https://github.com/shlomokabareti/convex-better-auth-2.0/actions/workflows/ci.yml
[docs-badge]: https://img.shields.io/badge/docs-online-292a44?style=for-the-badge
[docs]: https://gregarious-perch-710.convex.site
[license-badge]: https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=for-the-badge
[license]: LICENSE
[status-badge]: https://img.shields.io/badge/status-alpha-blueviolet.svg?style=for-the-badge
[status]: #status
[node-badge]: https://img.shields.io/badge/node->=20.12.0-brightgreen.svg?style=for-the-badge
[node]: package.json
[pnpm-badge]: https://img.shields.io/badge/pnpm-10.25.0-f69220.svg?style=for-the-badge
[pnpm]: package.json
