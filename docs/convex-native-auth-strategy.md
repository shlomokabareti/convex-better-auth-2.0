# Convex-native auth: the end-game for convex-better-auth-2.0

This document explains why the long-term goal of this repository is to move authentication _itself_ into Convex-native components, queries, mutations, and actions, and what that means for the Better Auth dependency. It is a strategy, not a specification.

For the recorded decisions on what is aligned with Convex Auth 2.0 and what is intentionally different, see [`docs/decisions/ADR-001-convex-auth-2.0-alignment.md`](./decisions/ADR-001-convex-auth-2.0-alignment.md).

## The short version

- Better Auth is a high-quality **Node.js/Edge** auth framework. Its plugin model, bundle shape, and crypto/runtime assumptions are built for a long-lived Node process, not Convex's V8 isolate runtime.
- The current `convex-better-auth-adapter` and `convex-better-auth` packages are a deliberate bridge: they keep Better Auth's battle-tested auth primitives while re-implementing the B2B control plane as Convex components.
- The bridge is the right way to ship now, but it is not the right end state. The end state is a **Convex-native auth runtime** that lives in the same database, uses the same query/subscription model as the rest of the app, and never pulls a Node auth framework into the isolate.
- We are **not** copying Convex Auth 2.0. We are learning from its design constraints and releasing our own implementation that preserves the B2B surface we have already built.

## Current status

The `convex-auth` native runtime is now the default. It implements email/password, JWT/JWKS, session minting and verification, email verification, password reset, email OTP, magic links, TOTP, backup codes, and OAuth (Google, GitHub, Discord) inside the Convex isolate using Web Crypto and `jose`.

The `convex-better-auth` and `convex-better-auth-adapter` packages remain as a staged migration bridge for existing Better Auth consumers. They keep auth working during a transition, but new projects should start with `convex-auth` directly.

## Why Better Auth does not fit the Convex runtime

Convex functions run in one of two runtimes. The default runtime is a custom V8-based JavaScript environment, similar to Cloudflare Workers, with strict constraints:

- **No cold starts.** Functions are always ready.
- **64 MB heap limit per function execution.**
- **32 MiB bundled source-code limit** for the `convex/` directory.
- **Web standard APIs** (`fetch`, `crypto`, `Headers`, `TextEncoder`, etc.). `fetch` is only available in **actions**.
- **No Node.js APIs** except `process.env`, `AsyncLocalStorage`, and `AsyncResource`.
- **Determinism required** in queries and mutations: no unseeded randomness, no network calls, no time drift.
- **Actions can opt into a Node.js runtime** with the `"use node";` directive and can use external packages, but they are separate from queries/mutations and have a different bundle and execution model.

Sources:

- [Convex Runtimes](https://docs.convex.dev/functions/runtimes)
- [Convex Bundling](https://docs.convex.dev/functions/bundling)
- [Convex Actions and the Node runtime](https://docs.convex.dev/functions/actions#choosing-the-runtime-use-node)

Better Auth, by contrast, is designed for a persistent Node.js process with hundreds of megabytes of RAM. It uses:

- Barrel imports like `better-auth` and `better-auth/plugins` that pull in the whole framework.
- Plugin instantiation (Zod schemas, nanostores, route tables, adapter state) at module-load time.
- Node crypto libraries (`argon2`, `jose` with Ed25519, dynamic `require`s).
- A request/response HTTP lifecycle and cookie/session state machine that assumes it owns the wire.

That mismatch is why the official `@convex-dev/better-auth` adapter requires `registerRoutesLazy()` and subpath imports (`better-auth/plugins/magic-link` instead of `better-auth/plugins`) to keep the bundle under the 32 MiB / 64 MB limits. Lazy registration defers initialization until an actual request arrives; subpath imports prevent the bundler from dragging in every plugin. Those are effective _mitigations_, but they do not change the architecture: Better Auth is still a Node framework running inside a non-Node isolate.

## What "Convex-native auth" means

The non-negotiable rule already stated in [`better-auth-to-convex.md`](./better-auth-to-convex) is:

> Better Auth owns authentication. The Convex component owns organizations, members, invitations, active org, permissions, and admin policy.

The next step is to move **authentication** itself into Convex. Concretely:

| Concern                        | Today (Better Auth + adapter)                                     | Target (Convex-native)                                                                           |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| User, session, identity tables | Better Auth writes them through the adapter                       | Convex component tables are the source of truth                                                  |
| Session minting                | `internalAdapter.createSession` in Better Auth                    | Convex action/mutation creates a token and writes the session                                    |
| Session verification           | Better Auth middleware validates token and calls the adapter      | Convex query reads the session and cryptographically verifies a JWT                              |
| Token signing (JWT/JWKS)       | Better Auth signs, `createConvexAuthConfig` points at Convex JWKS | Convex action signs with `crypto.subtle`; JWKS served by Convex query                            |
| Password hashing               | Better Auth core (Node `argon2` or similar)                       | Convex action using `@noble/hashes/argon2` (Node-free argon2id), or Web Crypto PBKDF2/Scrypt     |
| OAuth/social login             | Better Auth `genericOAuth` plugin                                 | Convex HTTP action implements per-provider OAuth flow with `fetch`                               |
| 2FA (TOTP / backup codes)      | Better Auth `twoFactor` plugin                                    | Convex action generates/secrets/verifies with `crypto.subtle` HMAC or a WebAssembly TOTP library |
| Email OTP / magic link         | Better Auth plugin                                                | Convex action generates a random token, stores a hash, sends email via provider                  |
| Client auth state              | `better-auth/react` `createAuthClient`                            | `ConvexAuthClient` built on `convex/react` `useQuery`/`useMutation`                              |
| Bearer token handling          | Better Auth `bearer` plugin                                       | Convex `http` router or action parses `Authorization` header                                     |

The key architectural shift is: **auth state is just Convex state**. A session becomes a row in a table. A permission check becomes a query. A login becomes a mutation or action. The client subscribes to the auth identity the same way it subscribes to any other Convex data.

## What the migration bridge still owns today

The `convex-better-auth` bridge package still relies on Better Auth for the auth primitives it was originally built on. This is only relevant while you are migrating; new `convex-auth` consumers use the native implementations above.

- `bearer` (token transport)
- `jwt` (JWT/JWKS signing)
- `twoFactor` (TOTP + backup codes)
- `emailOTP` and `magicLink` (token-based auth flows)
- `genericOAuth` (social/OAuth provider dance)
- `oneTimeToken`, `phoneNumber`, `username`, `anonymous`
- `createAuthClient` from `better-auth/react`
- `internalAdapter.createSession` / `deleteSession` for session minting

The B2B plugins (`organization`, `admin`, `api-key`, etc.) are already Convex-native in `packages/auth/src/component/`.

## Convex runtime constraints for each auth primitive

### Password hashing

- `crypto.subtle` supports PBKDF2 and Scrypt-like derivations in the default runtime.
- `argon2` is a Node native module and cannot run in the default runtime. Options:
  1. Use `@noble/hashes/argon2` (pure-JavaScript argon2id) in a Convex action — no Node runtime or `node:` imports.
  2. A WebAssembly build of argon2, imported as a `.wasm` file (counts toward bundle size).
  3. Use PBKDF2/Scrypt with high iteration counts in the default runtime.

Because hashing is non-deterministic and computationally expensive, it should live in an **action**.

### Token signing and JWKS

- `crypto.subtle` supports `RSASSA-PKCS1-v1_5` and `ECDSA`. Ed25519 is not standard in Web Crypto as of 2025; use Node or a WASM curve library if Ed25519 is required.
- Private keys can be stored as Convex environment variables or in an encrypted table.
- JWKS can be served by a Convex **query** (read-only, fast). Token refresh/minting happens in an **action** or a `signIn` **mutation**.

### Session lifecycle

- Session creation needs a token with entropy: use `crypto.getRandomValues` in an **action**, then write the session in a `runMutation`.
- Session lookup can be a query, but cryptographic JWT verification can also be done in the query with `crypto.subtle` (deterministic).
- Refresh is a mutation/action pair.

### OAuth

- OAuth token exchange and user-info `fetch` calls can only happen in **actions** (network is forbidden in queries/mutations).
- The OAuth state parameter, code verifier (PKCE), and final identity should be stored in Convex tables.
- Each provider (Google, GitHub, etc.) can be a small module with metadata (authorize URL, token URL, user-info URL, field mapping) and a shared OAuth flow.

### 2FA / email OTP / magic link

- TOTP secret generation and verification need a base32 codec and HMAC. Base32 and HMAC are implementable with Web Crypto in the default runtime.
- Random code generation for OTP/magic links must happen in an **action**.
- Tokens should be stored as hashes (HMAC or SHA-256) in the database, never plaintext.

## Phased roadmap

This roadmap has been implemented for `convex-auth`. Phases 1–7 are now live, and phase 8 is complete for the native runtime: `convex-auth` does not import or depend on the `better-auth` runtime. The bridge packages (`convex-better-auth` and `convex-better-auth-adapter`) still support staged migrations.

1. **Phase 0 — Stabilize the bridge (now).**
   - Release `convex-better-auth-adapter@0.13.0`, `convex-better-auth@2.0.0`, `convex-auth@1.0.0`, and siblings.
   - Confirm `registerRoutesLazy` and subpath imports keep the bundle under Convex limits.

2. **Phase 1 — Convex-first client.**
   - Replace `better-auth/react` `createAuthClient` with a `ConvexAuthClient` built on `convex/react`.
   - Move sign-in/sign-out UI flows to `useAction` and `useMutation` calls against the `convex-auth` component.
   - Keep the Better Auth server flow; only the client state machine changes.

3. **Phase 2 — Native session lifecycle.**
   - Add `convex-auth` tables for sessions and refresh tokens.
   - Implement `mintSession` as a Convex action using `crypto.getRandomValues` and `runMutation`.
   - Implement `verifySession` as a Convex query using `crypto.subtle` and the session table.
   - Replace `internalAdapter.createSession` / `deleteSession` calls.

4. **Phase 3 — Native JWT/JWKS.**
   - Generate and rotate signing keys in Convex actions.
   - Expose a `.well-known/jwks.json` query.
   - Update `createConvexAuthConfig` to consume the Convex-generated JWKS.

5. **Phase 4 — Native email/OTP/magic-link flows.**
   - Implement token generation, hashing, storage, and verification in Convex actions.
   - Provide email-sender hooks that call a provider action (`fetch` to SendGrid/Resend/SES).

6. **Phase 5 — Native 2FA.**
   - Implement TOTP secret provisioning and verification in Convex actions.
   - Store backup codes as hashed values.

7. **Phase 6 — Native OAuth/social providers.**
   - Implement per-provider OAuth flows as Convex HTTP actions.
   - Maintain a provider registry (metadata-only; no third-party OAuth framework).

8. **Phase 7 — Native password storage and verification.**
   - Move password hashing to a Convex action using the chosen runtime strategy (Node `argon2`, WASM, or Web Crypto PBKDF2/Scrypt).

9. **Phase 8 — Drop the Better Auth runtime dependency.**
   - `better-auth` may remain as a _dev/test_ dependency or be replaced entirely by provider metadata.
   - The public API (`convex-auth`, `convex-auth-react`, etc.) stays stable; only the internals change.

## Relationship to Convex Auth 2.0

Convex Auth 2.0 is Convex's own native auth solution. The lessons we take from it are:

- Auth must run in the same database and runtime as the app.
- Avoid pulling a Node auth framework into the V8 isolate.
- Use actions for non-deterministic or network work, queries/mutations for deterministic state.
- Lazy initialization and minimal bundle are critical.
- `ctx.auth` is the ergonomic surface.

We are **not** depending on or copying Convex Auth 2.0. We will release our own implementation because:

- We have already built a B2B control plane (orgs, members, invitations, permissions, API keys, service sessions, webhooks, MCP, agent auth) that Convex Auth 2.0 does not cover.
- We want to own the data model and auth semantics, not inherit Convex's choices.
- We want the project to remain an independent public package that the Convex + Better Auth community can co-maintain.

### Patterns from Convex Auth we can adopt

Convex Auth 2.0 is a proof that a native Convex auth runtime is possible. We should copy the _structure_, not the package:

- **Table layout:** Convex Auth uses `users`, `authSessions`, `authAccounts`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, and `authRateLimits`. We can align our schema with these names and indexes so migration guides are simple.
- **Function layout:** `convexAuth({ providers })` returns `auth` (HTTP router helper), `signIn` (action), `signOut` (action), `store` (internal mutation), and `isAuthenticated` (query). This is a clean public seam: one file, one helper, one provider array.
- **HTTP routes:** `auth.addHttpRoutes(http)` adds `/.well-known/openid-configuration`, `/.well-known/jwks.json`, and per-provider OAuth callback paths (`/api/auth/signin/*`, `/api/auth/callback/*`) to the Convex `httpRouter`.
- **Provider model:** Convex Auth imports provider _metadata_ from `@auth/core/providers/*` (e.g., `GitHub`, `Google`, `Resend`). These are pure data objects — OAuth URLs, scopes, token/user-info endpoints. We can use the same metadata if we keep our runtime separate, or we can hand-author provider definitions. The point is: do not re-implement the OAuth protocol spec from scratch unless we have to.
- **Token generation:** Use `crypto.getRandomValues` in actions for random tokens, not `Math.random` or Node `crypto.randomBytes`.
- **Keys:** Convex Auth stores `JWT_PRIVATE_KEY` and `JWKS` in Convex environment variables and generates them with `jose` locally. We can do the same for the first release, then move to a `authKeys` table with rotation later.
- **Client surface:** `ConvexAuthProvider` wraps `ConvexProvider` and `useAuthActions()` exposes `signIn`, `signOut`, and `signInWithRedirect`. This is the same shape we should aim for in `convex-auth-react`.

## Why this is the right long-term move

- **Bundle size and memory.** Removing Better Auth from the Convex bundle is the only way to guarantee the `convex/` directory stays under 32 MiB and each function stays under 64 MB.
- **Determinism and real-time sync.** Session and identity state live in Convex tables; clients subscribe to it naturally. No more "logged in locally but not yet synced to the server" race conditions.
- **Authorization.** Convex authorization rules can depend on auth tables directly, without going through an adapter.
- **Operational simplicity.** One stack, one runtime, one set of indexes, one set of migrations.
- **Maintainability.** Future maintainers only need to know Convex and web standards, not a Node auth framework's plugin model.

## Immediate milestones

The strategic roadmap is long. The _right now_ milestones are deliberately small and provable.

### Milestone 0 — Ship the bridge

- Unblock the release by replacing the GitHub `NPM_TOKEN` with an npm Automation token that has **Publish** scope.
- Publish `convex-better-auth-adapter@0.13.0`, `convex-better-auth@2.0.0`, `convex-auth@1.0.0`, and siblings.
- This is a release, not a rewrite.

### Milestone 1 — Native email/password sign-in

This is the smallest end-to-end flow that proves the new architecture. It should live behind a feature flag and not break Better Auth consumers.

1. **Schema.** Add `authSessions`, `authAccounts`, and `authRefreshTokens` tables to the `convex-auth` component (or start by writing to the existing `better-auth-adapter` component tables to avoid a migration).
2. **Keys.** Generate an RS256 keypair locally, store `JWT_PRIVATE_KEY` and `JWKS` in the Convex deployment environment, and expose `/.well-known/jwks.json` via a Convex query.
3. **Password hashing.** Implement a Convex action using `@noble/hashes/argon2` for argon2id hashing, with no Node runtime or `node:` imports.
4. **Sign-up / sign-in actions.** Implement `signUp`, `signIn`, `signOut`, and `store` Convex actions.
   - `signUp` hashes the password, creates a `users` row, an `auth_identities` row, and an `authAccounts` row.
   - `signIn` verifies the password hash in a Convex action, then creates an `authSessions` row and returns a signed JWT.
   - `signOut` invalidates the session.
5. **Session verification.** Implement a Convex query `verifySession` that reads the JWT from `ctx.auth`, verifies the signature with `crypto.subtle`, and returns the user.
6. **Client.** Add `ConvexAuthProvider` and `useAuthActions()` to `convex-auth-react` that use `useQuery`/`useAction`/`useMutation` against the new actions.
7. **Flag.** Gate this behind `ConvexAuthProvider native` or a similar opt-in so existing consumers keep Better Auth.

Milestone 1 proves the three most questioned primitives: **password hashing, session minting, and JWT verification inside the Convex runtime.**

### Milestone 2 — Email verification and password reset

- Generate random tokens with `crypto.getRandomValues` in a Convex action.
- Store hashed verification codes with expiry.
- Send email via a configured email sender (Resend/SES/SendGrid) in an action.
- Implement the password-reset flow with a two-step token.

### Milestone 3 — OAuth with one provider

- Implement a single OAuth provider (GitHub) as a Convex HTTP action.
- Use `@auth/core/providers/github` only for the provider _metadata_ — URLs, scopes, field mapping — not for runtime.
- Add `/api/auth/signin/github` and `/api/auth/callback/github` HTTP routes.
- On callback, fetch the token and user info with `fetch`, provision the identity, and create a session.

### Milestone 4 — Expand to more providers, 2FA, and social flows

- Add more OAuth providers from `@auth/core/providers/*` metadata.
- Implement TOTP with Web Crypto HMAC.
- Implement magic-link / OTP sign-in.

### Milestone 5 — Drop the Better Auth dependency

- Once all auth flows are native, `better-auth` becomes a dev-only or test-only dependency.
- Existing consumers can migrate table-by-table or re-install under the new `convex-auth` schema.

## What the community can help with

This is a multi-month, multi-maintainer effort. Good entry points for new maintainers:

- Provider implementations for specific OAuth services.
- TOTP and Web Crypto helpers.
- Migration guides from `@convex-dev/better-auth` and from Better Auth proper.
- Bundle-size regression tests and `npx convex dev --once --debug-bundle-path` reports.
- Test harnesses that prove each phase works against a live Convex backend.

See [`MAINTAINERS.md`](../MAINTAINERS.md) (when it exists) and [`CONTRIBUTING.md`](../CONTRIBUTING.md) for how to get involved.

## References

- [Convex Runtimes](https://docs.convex.dev/functions/runtimes)
- [Convex Bundling](https://docs.convex.dev/functions/bundling)
- [Convex Actions and the Node runtime](https://docs.convex.dev/functions/actions#choosing-the-runtime-use-node)
- [Better Auth to Convex mapping in this repo](./better-auth-to-convex)
