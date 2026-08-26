# Why `convex-better-auth-2.0` exists

This workspace is a full-stack, open-source auth solution that sits at the intersection of [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

## The three problems it addresses

### 1. Convex Auth 2.0 is still coming

Convex has announced that a richer built-in auth system is on the roadmap. Until it ships, Convex apps need a way to run production-grade auth today without betting against Convex's eventual first-class solution. Better Auth is the best available option for the feature set, but it is not designed around Convex's component and query model out of the box.

### 2. The Better Auth plugin model and Convex's component system fight each other

Better Auth is built as a pluggable Node/Edge framework. Its plugins assume they own the runtime, the database calls, and the request/response lifecycle. Convex is different: the source of truth is a durable, transactional database with generated query/mutation/action functions and a component model for reusable packages.

When you install `@convex-dev/better-auth`, you immediately hit impedance mismatches:

- Better Auth wants to run `betterAuthHandler` inside an HTTP action; Convex wants `http.ts` route handlers.
- Better Auth's plugins store state in their own tables; Convex wants those tables inside a reusable, versioned component.
- Better Auth's client is generic; Convex's client needs `ConvexReactClient` integration, query preloading, and optimistic auth state.

Without a bridge, every team ends up writing the same glue and making the same security mistakes.

### 3. Convex should eventually own the auth-specific work, but not by throwing Better Auth away

The long-term goal is for Convex to provide native, component-based auth that keeps users, sessions, organizations, API keys, and scopes inside the same database as the rest of the app. That is the right design. But Convex does not yet cover the breadth of features Better Auth has built:

- Password / email verification / password reset flows
- OAuth and social providers
- Two-factor authentication (TOTP, backup codes)
- Organization / workspace / invitation flows
- API keys and service sessions
- Webhook fan-out and security
- MCP and agent-auth protocols

Until Convex natively covers that surface, removing Better Auth is a net loss. The pragmatic path is to wrap Better Auth's battle-tested primitives inside a Convex-native component and client runtime, then migrate pieces to native Convex auth as the platform catches up.

## What this repo does about it

`convex-better-auth-2.0` provides that bridge. It packages:

- `convex-better-auth` — a runtime that maps Better Auth state into Convex's client and server model.
- `convex-auth` — a Convex component with the control plane: users, organizations, scopes, API keys, webhooks, MCP, and agent auth.
- `convex-auth-react` — React UI and hooks that are auth-first and Convex-integrated.
- `convex-auth-react-native` — Expo / React Native client and forms.

All four packages are self-contained, Apache-2.0, and have no dependencies on private Vortex packages.
