# Spec: Milestone 1 & 2 catch-up — Better Auth email/password parity

## Objective

Bring the native Convex email/password runtime (`nativeEmailAndPassword`) and its supporting pieces up to Better Auth 1.7 behavior, while staying inside the Convex-native component/action/query model. Milestone 1 is the end-to-end email/password flow; Milestone 2 is email verification and password reset.

## Source of truth

- Better Auth 1.7.2 installed in the workspace: `node_modules/.pnpm/better-auth@1.7.2*/dist/api/routes/{sign-up,sign-in,sign-out,password,email-verification}.mjs` and their `.d.mts` types.
- Convex docs for actions, queries, and the Node runtime.

## Current state

A working native email/password flow exists in `packages/auth/src/convex-runtime/native/provider.ts`:

- `signUp`, `signIn`, `signOut` actions.
- `sendEmailVerification`, `verifyEmail`, `sendPasswordReset`, `resetPassword` actions.
- `hashPassword` / `verifyPassword` in `packages/auth/src/convex-runtime/native/password.ts`.
- `mintToken` / `verifyToken` in `packages/auth/src/convex-runtime/native/jwt.ts`.
- `ConvexAuthProvider` and `useAuthActions` in `packages/react/src/ConvexAuthProvider.tsx`.
- Unit tests in `packages/auth/src/convex-runtime/native/provider.test.ts` and `password.test.ts`.

## Gaps vs Better Auth 1.7

### Password hashing (Milestone 1)

- `password.ts` uses `@noble/hashes` (scrypt/pbkdf2) and has no `node:` imports. Better Auth 1.7 defaults to `argon2id` via its `password` config and `ctx.context.password.hash`. The spec for Milestone 1 calls for `argon2id` via `@noble/hashes/argon2` in a Convex action, keeping the runtime Node-free.
- Hash prefix is `$scrypt$`. Better Auth uses `$argon2id$...` or its configured hasher.
- Switching must be backwards-compatible for already-stored scrypt hashes so existing tests/users keep working.

### Input validation (Milestone 1 & 2)

- `signUp` does not validate password `minLength` / `maxLength`.
- `resetPassword` does not validate new password `minLength` / `maxLength`.
- Better Auth 1.7 enforces `minPasswordLength` (default 8) and `maxPasswordLength` (default 128? need confirm from installed defaults).
- `signUp` `name` is optional; Better Auth requires it.
- `signUp` / `signIn` do not validate email format before lowercasing.

### Sign-up / sign-in surface (Milestone 1)

- Better Auth `signUp` body: `name`, `email`, `password`, `image?`, `callbackURL?`, `rememberMe?`, plus additional user fields.
- Better Auth `signUp` returns `{ token: string | null, user }` and sets a session cookie when `token` is non-null.
- Our `signUp` returns `{ token, userId, identityId, sessionId }` and never returns the user object.
- Better Auth `signIn` body: `email`, `password`, `callbackURL?`, `rememberMe?`; returns `{ token, user, redirect, url? }`.
- Our `signIn` returns `{ token, userId, identityId, sessionId }`.
- Better Auth `signOut` body: `callbackURL?`, `disableRedirect?`, `state?`; returns `{ success, url?, redirect? }`.
- Our `signOut` takes only `token` and returns `{ success }`.
- `rememberMe` is ignored. Better Auth uses it to control session TTL/cookie persistence.

### Auto sign-in and email verification gating (Milestone 1)

- Better Auth `signUp`:
  - checks `emailAndPassword.enabled` and `emailAndPassword.disableSignUp`.
  - if `requireEmailVerification` or `autoSignIn === false`, it returns `token: null` and a synthetic user on existing-email and on successful creation.
  - if `emailVerification.sendOnSignUp` or `emailAndPassword.requireEmailVerification` is set, it sends a verification email immediately after sign-up.
  - it mitigates timing attacks by hashing the password and doing a dummy lookup when returning a generic duplicate response.
- Our `signUp` always creates a session and returns a token. It never sends the verification email automatically.

### Session lifecycle (Milestone 1)

- `mintToken` hard-codes `7d` JWT expiry and ignores `sessionTtlMs` and `rememberMe`.
- No `verifySession` Convex query or `/.well-known/jwks.json` route is exposed.
- Better Auth `updateSession` route exists; we have no equivalent.

### Password reset (Milestone 2)

- Better Auth:
  - `requestPasswordReset` POST `/request-password-reset` with `email` and `redirectTo`.
  - `requestPasswordResetCallback` GET `/reset-password/:token` with `callbackURL`, redirects to `callbackURL?token=...` on success or `callbackURL?error=INVALID_TOKEN` on failure.
  - `resetPassword` POST `/reset-password` with `newPassword` and `token` (body or query), validates password length, updates hash, optionally revokes sessions, calls `onPasswordReset`, returns `{ status: true }`. It does **not** automatically sign in.
- Our `sendPasswordReset` only takes `email` and uses a config-level `resetPath`.
- Our `resetPassword` consumes the token, updates the hash, then creates a new session and revokes other sessions, returning `{ success, token, ... }`. This diverges from Better Auth.
- No GET callback endpoint for the reset link.

### Verify password (Milestone 2)

- Better Auth has a server-scoped `/verify-password` endpoint that checks the current session user's password.
- We have no equivalent.

### Email verification flow (Milestone 2)

- Better Auth:
  - `sendVerificationEmail` POST `/send-verification-email` with `email` and optional `callbackURL`.
  - `verifyEmail` GET `/verify-email` with `token` and optional `callbackURL`. On success it can redirect to `callbackURL`.
- Our `sendEmailVerification` is an action with only `email`.
- Our `verifyEmail` is an action that returns JSON, with no redirect/callback support.

### Client surface (Milestone 1)

- `useAuthActions` currently exposes only the minimal fields. It does not pass `image`, `callbackURL`, `rememberMe`, etc.
- Better Auth client `signUp.email`, `signIn.email` mirror the server bodies.

## In scope for this catch-up

1. Password hashing parity:
   - Add `argon2id` hashing in a Convex action using `@noble/hashes/argon2` (Node-free).
   - Make `verifyPassword` recognize both `$scrypt$` (legacy) and `$argon2id$` hashes.
   - Default to argon2id for new hashes.

2. Input validation:
   - `signUp` and `resetPassword` must enforce configurable `minPasswordLength` and `maxPasswordLength`.
   - `signUp` `name` required.
   - Email format validation.

3. Return `user` object from `signUp` and `signIn`.

4. `rememberMe` support:
   - Accept `rememberMe` in `signUp` and `signIn`.
   - Use it to set session TTL (and token expiry) to a short-lived value when `false`.

5. `signUp` gating:
   - Respect `disableSignUp` and `enabled` flags.
   - Send verification email on sign-up when configured.
   - Return `token: null` when email verification is required or auto sign-in is disabled.
   - Mitigate timing attacks on existing email.

6. `callbackURL` support on `signIn`/`signOut` (return redirect URLs where appropriate).

7. Password reset parity:
   - Add `requestPasswordResetCallback` GET route.
   - Change `resetPassword` to return only `{ status: boolean }` and not auto-sign-in (unless we decide to keep the convenience — note as a divergence).
   - Add `redirectTo` to `sendPasswordReset`.
   - Add `verifyPassword` action.

8. Email verification parity:
   - Support `callbackURL` in `sendEmailVerification` and `verifyEmail`.

9. Session verification / JWKS:
   - Add `verifySession` query.
   - Add `/.well-known/jwks.json` HTTP route.
   - Make `mintToken` honour `sessionTtlMs` and `rememberMe`.

10. Client updates in `ConvexAuthProvider` to expose the new args and results.

## Out of scope for this catch-up

- Two-factor / backup codes (Milestone 5 territory).
- Magic-link / email-OTP (Milestone 4).
- Additional user field extensibility via plugins (track separately).
- HTTP route mounts for sign-up/sign-in beyond what the Convex client already needs.

## Build order

1. Add argon2 hashing and password validation.
2. Return `user` from sign-up/sign-in and add `rememberMe`.
3. Add sign-up gating and timing-mitigation.
4. Add `verifySession` query and `/.well-known/jwks.json`.
5. Align password reset flow (callback route, no auto-sign-in, `redirectTo`).
6. Align email verification (`callbackURL`, redirect).
7. Update `ConvexAuthProvider`/`useAuthActions`.
8. Full proof and PR.

## Success criteria

- `pnpm run typecheck`, `pnpm run check`, `pnpm run build`, `pnpm test` all pass.
- New tests cover argon2 round-trip, password validation, `rememberMe` TTL, returned user, verify session, and reset/verification callback flows.
- Native `provider.test.ts` still passes with legacy scrypt hashes.
- A fresh GitHub PR is open for the catch-up branch.

## Boundaries

- Always: run the focused tests after every slice, run the full proof before the PR.
- Ask first: changing the `users`/`authAccounts` schema beyond adding nullable fields or indexes.
- Never: commit real credentials, remove existing scrypt support before all legacy hashes are migrated, or disable security gates to pass tests.
