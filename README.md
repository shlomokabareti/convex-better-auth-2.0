# convex-better-auth-2.0

A public, full-stack auth solution that bridges [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

## Why this exists

Convex is building the future of auth, but it is not there yet. Better Auth has the most complete feature set today, but it is not designed around Convex's component, query, and mutation model. Most teams who try to combine the two end up rewriting the same glue and making the same security mistakes.

This repo is the pragmatic middle path:

1. **Convex Auth 2.0 is still coming.** Until Convex ships a first-class, native auth system, teams need a production-grade option that does not block them.
2. **Better Auth's plugin model and Convex's component system fight each other.** Better Auth assumes it owns the runtime and tables; Convex wants auth inside a versioned component with generated queries and mutations. Without a bridge, the two leak into each other.
3. **Convex should eventually own auth, but not by throwing Better Auth away.** Better Auth already covers password/email flows, OAuth, 2FA, organizations, API keys, webhooks, and more. The right move is to rebuild those plugin features as Convex-style components, queries, mutations, and actions, then replace pieces with native Convex auth as the platform catches up.

Read the full rationale in [`docs/motivation.md`](docs/motivation.md) and the design details in [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md).

## Packages

| Package                    | Path                    | Description                                                                                   |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `convex-auth`              | `packages/auth`         | Convex auth component, control plane, and server integration. This is what most apps install. |
| `convex-better-auth`       | `packages/better-auth`  | Better Auth ↔ Convex bridge (runtime + client).                                               |
| `convex-auth-react`        | `packages/react`        | React UI and hooks.                                                                           |
| `convex-auth-react-native` | `packages/react-native` | Expo / React Native client.                                                                   |
| `convex-auth-core`         | `packages/core`         | Auth domain core (permissions, roles, scopes).                                                |
| `convex-auth-ui`           | `packages/ui`           | Base shadcn-style UI primitives.                                                              |

All packages are independently buildable and published under the Apache-2.0 license.

## Installation

Most Convex apps should start with `convex-auth` for the backend and `convex-auth-react` for the UI:

```bash
pnpm add convex-auth convex-auth-react
```

`convex-auth` re-exports the component, server helpers, and React entry points. If you are building a React app, install `convex-auth-react` separately so your bundler can tree-shake UI-only code.

### Peer dependencies

`convex-auth` requires `convex` and `better-auth` (and optionally `@convex-dev/better-auth`) as peers. Make sure they are installed in your app:

```bash
pnpm add convex better-auth
```

### React Native / Expo

`convex-auth-react-native` is used for Expo and React Native apps. It has additional peer dependencies:

- `react-native` `>=0.81.0`
- `@better-auth/expo` `>=1.6.0 <1.7.0`
- `better-auth` `>=1.6.11 <1.7.0`
- `convex-better-auth` `>=0.1.0-alpha.0`

Install it alongside the Expo Better Auth plugin:

```bash
pnpm add convex-auth-react-native @better-auth/expo
```

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
import { convexClient } from "@convex-dev/better-auth/client/plugins";

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

This repo uses pnpm and [Vite+](https://github.com/voidzero-dev/vite-plus) (`vp`) for building, linting, and formatting.

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

A GitHub Actions workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). It runs the full proof (`typecheck`, `check`, `build`, `test`) on Node 18 and Node 22.

## License

Apache-2.0 — see `LICENSE`.
