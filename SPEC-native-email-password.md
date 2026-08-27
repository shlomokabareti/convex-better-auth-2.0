# Spec: Native email/password sign-in for `convex-auth`

## Objective

Build a feature-flagged, Convex-native email/password flow in the `convex-auth` package. It must prove that password hashing, session creation, JWT minting, and JWT verification can all run inside Convex, while leaving the existing Better Auth bridge untouched.

Success criteria:
- A user can `signUp(email, password)` and receive a signed JWT.
- A user can `signIn(email, password)` and receive a signed JWT.
- A user can `signOut()` and the session is invalidated.
- Passwords are never stored in plain text and hashing runs in a Convex Node action.
- `/.well-known/jwks.json` exposes the public keys used to verify JWTs.
- The React package exposes `ConvexAuthProvider` and `useAuthActions()` modeled on Convex Auth.
- All existing Better Auth consumers are unaffected unless they explicitly opt in.
- Full proof passes: `pnpm run typecheck`, `vp check`, `pnpm run build`, `pnpm run test`.

## Tech stack

- Convex component runtime for tables/mutations/queries/actions.
- Convex Node actions (`"use node";`) for password hashing and JWT signing.
- `argon2` or `@node-rs/argon2` for password hashing in the Node action.
- `jose` for JWT signing/verification and JWKS creation.
- RS256 keypair stored in `JWT_PRIVATE_KEY` and `JWKS` deployment environment variables.
- Existing `packages/auth/src/component/schema.ts` tables extended with `authSessions` and `authAccounts`.
- Existing `packages/auth/src/component/identity.ts` provisioning reused for user/identity creation.
- `packages/react` for `ConvexAuthProvider` and `useAuthActions`.

## Project structure

- `packages/auth/src/component/schema.ts` — add `authSessions` and `authAccounts` tables.
- `packages/auth/src/component/keys.ts` — load `JWT_PRIVATE_KEY`/`JWKS` and expose JWKS.
- `packages/auth/src/convex-runtime/actions/hashPassword.ts` — Node action for password hashing.
- `packages/auth/src/convex-runtime/actions/verifyPassword.ts` — Node action for password verification.
- `packages/auth/src/convex-runtime/actions/signUp.ts` — sign-up action.
- `packages/auth/src/convex-runtime/actions/signIn.ts` — sign-in action.
- `packages/auth/src/convex-runtime/actions/signOut.ts` — sign-out action.
- `packages/auth/src/convex-runtime/http.ts` — `/.well-known/jwks.json` route.
- `packages/react/src/ConvexAuthProvider.tsx` — provider and `useAuthActions`.
- `packages/auth/src/convex-runtime/actions/*.test.ts` — Vitest unit tests.

## Code style

- No `any`; use `unknown` and narrow.
- Use Convex validators for all public function args.
- Keep feature-flag opt-in at the `convexAuth()` helper level.
- Do not copy Convex Auth internals; only mirror its public shape.

## Testing strategy

- Vitest for Node action password hashing/verification.
- Convex test harness for `signUp`/`signIn`/`signOut` actions.
- JWT tests verify sign → verify round-trip and expired token rejection.
- JWKS endpoint test verifies the key is exposed and parseable.

## Boundaries

- Always: feature-gate the native flow, run full proof before commit, use `vp fmt`/`vp lint`.
- Ask first: changing the public API surface of `packages/auth`, adding heavy dependencies.
- Never: remove Better Auth tables, expose private keys, store plain-text passwords.

## Open questions

1. Should the prototype reuse existing `better-auth-adapter` `user`/`session`/`account` tables, or add `authSessions`/`authAccounts` to the `convex-auth` component? **Decision: add native tables to `convex-auth` component; keep Better Auth tables isolated.**
2. Which password hashing library is installable in the Convex Node action runtime? **Decision: start with `@node-rs/argon2` and fall back to `argon2` if bundle/runtime issues arise.**
