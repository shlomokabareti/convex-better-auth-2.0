# Why `convex-better-auth-2.0` exists

This workspace is a full-stack, open-source auth solution that sits at the intersection of [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

## Where it came from

This is an open-source, full-stack auth stack for Convex. The goal is to give Convex developers an out-of-the-box auth layer that covers the same surface area as Clerk or WorkOS, without giving up Convex's native database model.

## The three problems it addresses

### 1. Convex Auth 2.0 is still coming

Convex has made it clear that a richer built-in auth system is on the roadmap. Until it ships, Convex apps need a way to run production-grade auth today without betting against Convex's eventual first-class solution. Better Auth is the best available option for the feature set, but it is not designed around Convex's component and query model out of the box.

### 2. The Better Auth plugin model and Convex's component system fight each other

Better Auth is built as a pluggable Node/Edge framework. Its plugins assume they own the runtime, the database calls, and the request/response lifecycle. Convex is different: the source of truth is a durable, transactional database with generated query/mutation/action functions and a component model for reusable packages.

When you install the standard Better Auth Convex integration, you immediately hit impedance mismatches:

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

Until Convex natively covers that surface, removing Better Auth is a net loss. The pragmatic path is to **rebuild Better Auth's plugin features as Convex-style components, queries, mutations, and actions** — keeping auth in the same DB and using Better Auth's primitives where they add value.

See [`better-auth-to-convex.md`](better-auth-to-convex.md) for the full mapping.

## Why not just use Clerk or WorkOS?

Clerk and WorkOS are great products. They are also **external auth platforms** that own your users, sessions, and organization data. That creates two problems for a Convex app:

1. **Data gravity.** Auth state lives outside Convex, so every auth check is a network call, every organization lookup is a network call, and every audit log is a sync problem.
2. **Lock-in.** The longer you stay on a hosted auth platform, the deeper your schema and UI depend on its shapes and its availability.

This project gives you the Clerk/WorkOS feature surface — users, orgs, invites, roles, API keys, OAuth, 2FA, webhooks, machine auth — while keeping the source of truth in **your Convex database**. You own the domain. The auth provider is a component inside your backend, not a separate service.

## What this repo does about it

`convex-better-auth-2.0` provides that bridge. It packages:

- `convex-better-auth-adapter` — the low-level Better Auth ↔ Convex database adapter, vendored from the community work at `get-convex/better-auth` and maintained here with Better Auth 1.7 support.
- `convex-better-auth` — a runtime that maps Better Auth state into Convex's client and server model.
- `convex-auth` — a Convex component with the control plane: users, organizations, scopes, API keys, webhooks, MCP, and agent auth.
- `convex-auth-react` — React UI and hooks that are auth-first and Convex-integrated.
- `convex-auth-react-native` — Expo / React Native client and forms.
- `convex-auth-core` — shared auth domain types and utilities: permissions, roles, and scopes.
- `convex-auth-ui` — base shadcn-style UI primitives.

All packages are self-contained, Apache-2.0, and have no dependencies on private packages.
