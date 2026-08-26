# convex-better-auth-2.0

A public, full-stack auth solution that bridges [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

## Why this exists

Convex is building the future of auth, but it is not there yet. Better Auth has the most complete feature set today, but it is not designed around Convex's component, query, and mutation model. Most teams who try to combine the two end up rewriting the same glue and making the same security mistakes.

This repo is the pragmatic middle path:

1. **Convex Auth 2.0 is still coming.** Until Convex ships a first-class, native auth system, teams need a production-grade option that does not block them.
2. **Better Auth's plugin model and Convex's component system fight each other.** Better Auth assumes it owns the runtime and tables; Convex wants auth inside a versioned component with generated queries and mutations. Without a bridge, the two leak into each other.
3. **Convex should eventually own auth, but not by throwing Better Auth away.** Better Auth already covers password/email flows, OAuth, 2FA, organizations, API keys, webhooks, and more. The right move is to rebuild those plugin features as Convex-style components, queries, mutations, and actions, then replace pieces with native Convex auth as the platform catches up.

Read the full rationale in [`docs/motivation.md`](docs/motivation.md) and the design details in [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md).

## Origin

This is an open-source, full-stack auth stack for Convex. The goal is to give Convex developers an out-of-the-box auth layer that covers the same surface area as Clerk or WorkOS, without giving up Convex's native database model.

## Packages

| Package                    | Path                    | Description                           |
| -------------------------- | ----------------------- | ------------------------------------- |
| `convex-auth-core`         | `packages/core`         | Auth domain core (permissions, etc.)  |
| `convex-better-auth`       | `packages/better-auth`  | Better Auth ↔ Convex bridge           |
| `convex-auth`              | `packages/auth`         | Convex auth component + control plane |
| `convex-auth-react`        | `packages/react`        | React UI and hooks                    |
| `convex-auth-react-native` | `packages/react-native` | Expo / React Native client            |
| `convex-auth-ui`           | `packages/ui`           | Base shadcn-style UI primitives       |

All packages are independently buildable and published under the Apache-2.0 license.

## Build

```bash
pnpm install
pnpm build
```

## License

Apache-2.0 — see `LICENSE`.
