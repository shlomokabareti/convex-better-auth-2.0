# Spec: Email verification and password reset for `convex-auth`

## Objective

Add email verification and password reset flows to the native Convex email/password provider (`convex-runtime/native`) introduced in Milestone 1. These are the two most common post-sign-up account flows and the smallest end-to-end expansion that proves token generation, secure token storage, expiry, and email delivery inside Convex actions.

Success criteria:
- A user who signs up with email/password can request a verification email.
- The verification email contains a single-use, time-limited token.
- The user can verify their email by supplying the token, which updates the user and identity `emailVerified` flags.
- A user who has forgotten their password can request a password-reset email.
- The password-reset email contains a single-use, time-limited token.
- The user can set a new password by supplying the token and a new password.
- Tokens are stored as hashes, never plaintext, and are consumed/deleted on use.
- Existing Better Auth consumers are unaffected unless they opt in.
- All flows are feature-flagged through the same `nativeEmailAndPassword` provider path.
- Full proof passes: `pnpm run typecheck`, `vp check`, `pnpm run build`, `pnpm test`.

## Tech stack

- Convex component tables: `authVerificationCodes` for one-time tokens.
- Convex Node actions (`"use node";`) for token hashing/verification and password hashing.
- `crypto.getRandomValues` (via Node `crypto.webcrypto`) for token entropy; tokens are hashed with SHA-256 and compared with `crypto.timingSafeEqual`.
- `argon2` via the existing `packages/auth/src/convex-runtime/native/password.ts` for new password hashing.
- `jose` for existing JWT session minting and verification.
- Existing `packages/auth/src/convex-runtime/account/emailVerificationEmail.tsx` and `passwordResetEmail.tsx` for email rendering, with a minimal sender hook.
- `packages/auth/src/component/schema.ts` for the new table.
- `packages/react/src/ConvexAuthProvider.tsx` for client hooks.

## Project structure

- `packages/auth/src/component/schema.ts` — add `authVerificationCodes` table.
- `packages/auth/src/component/native/codes.ts` — mutations/queries for creating, consuming, and looking up verification codes.
- `packages/auth/src/convex-runtime/native/tokens.ts` — token generation and hash/verify utilities.
- `packages/auth/src/convex-runtime/native/tokens.test.ts` — unit tests for token hashing.
- `packages/auth/src/convex-runtime/native/provider.ts` — add `sendEmailVerification`, `verifyEmail`, `sendPasswordReset`, `resetPassword` actions.
- `packages/auth/src/convex-runtime/native/provider.test.ts` — extend tests for new actions.
- `packages/auth/src/convex-runtime/native/types.ts` — extend `NativeEmailAndPasswordComponentHandle` and `NativeEmailAndPasswordActions`.
- `packages/auth/src/convex-runtime/account/index.ts` — export existing email helpers.
- `packages/react/src/ConvexAuthProvider.tsx` — add `sendEmailVerification`, `verifyEmail`, `sendPasswordReset`, `resetPassword` to `NativeAuthActions` and `useAuthActions`.

## Code style

- No `any`; use `unknown` and narrow.
- Use Convex validators for all public function args and returns.
- Token storage uses `tokenHash` (hex string), not the raw token.
- Expiry uses absolute `expiresAt` timestamps (ms since epoch).
- Actions are idempotent where safe: sending a new code invalidates the previous code of the same type for the same user.
- Email sending is behind a callback so tests never hit real email providers.

## Testing strategy

- Unit tests for `tokens.ts`: generate, hash, verify, expiry, and constant-time comparison.
- Convex test harness for `provider.ts` actions: send/verify email, send/reset password, expiry, consumption, and idempotency.
- React package tests for `ConvexAuthProvider` action wiring.
- Mock `sendEmail` callback to capture drafts and return deterministic `emailId`s.

## Boundaries

- **Always:** feature-gate native flows, run full proof before commit, use `vp fmt`/`vp lint`.
- **Ask first:** changing the public API surface of `packages/auth`, adding heavy dependencies.
- **Never:** store plaintext tokens, expose token hashes to the client, skip expiry, or remove Better Auth tables.

## Open questions

1. Should `signIn` reject unverified emails by default, or only when the consumer opts in?
2. Should `resetPassword` also revoke all existing sessions for the user?
3. Which email provider integration should be the default? (The renderer already supports Resend-style `sendEmail` callback.)

## Success criteria

- `pnpm run typecheck` passes.
- `vp check` passes.
- `pnpm test` passes.
- `pnpm run build` produces `dist/` with the new exports.
- A test consumer can request, verify, reset, and change a password end-to-end using mocked email delivery.
