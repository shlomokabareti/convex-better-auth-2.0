# Implementation Plan: Email verification and password reset

## Overview

Extend the native Convex email/password provider with token-based email verification and password reset. The work is additive to the existing `convex-runtime/native` flow: a new `authVerificationCodes` table stores hashed one-time tokens, the `provider.ts` adds four new actions, and `ConvexAuthProvider` exposes them to React consumers.

## Architecture decisions

- Tokens are generated in a Node action (`"use node";`) using `crypto.webcrypto.getRandomValues`, then hashed with SHA-256 before storage. The raw token is only returned to the user via email.
- Verification codes are consumed on first successful use and deleted to prevent replay.
- Sending a new code of the same type for the same user invalidates the previous code (idempotency / anti-spam).
- `sendEmail` is a callback passed into the provider so tests and consumers can plug in Resend, SES, SendGrid, or a mock without changing `convex-auth`.
- `resetPassword` reuses the existing `hashPassword` from `packages/auth/src/convex-runtime/native/password.ts`.
- `verifyEmail` reuses the existing `emailVerificationEmail.tsx` renderer and `buildEmailVerificationUrl`.
- `sendPasswordReset` reuses `passwordResetEmail.tsx` and `buildPasswordResetUrl`.

## Task list

### Phase 1: Schema and component storage

- [ ] Task 1: Add `authVerificationCodes` table to `packages/auth/src/component/schema.ts`
  - Acceptance: table has `userId`, `type`, `tokenHash`, `expiresAt`, `consumedAt`, `createdAt` and indexes by `tokenHash` and `user/type`.
  - Verify: `pnpm run typecheck` and `pnpm run build` pass.

- [ ] Task 2: Add `packages/auth/src/component/native/codes.ts`
  - Acceptance: mutations `createVerificationCode`, `consumeVerificationCode`, `revokeVerificationCodesForUser`; query `getVerificationCodeByTokenHash`.
  - Verify: unit tests in `packages/auth/src/component/native/codes.test.ts` pass.

### Phase 2: Token utilities

- [ ] Task 3: Add `packages/auth/src/convex-runtime/native/tokens.ts`
  - Acceptance: `generateVerificationToken`, `hashToken`, `verifyTokenHash`, `isTokenExpired` are exported and tested.
  - Verify: `pnpm test packages/auth/src/convex-runtime/native/tokens.test.ts` passes.

### Phase 3: Provider actions

- [ ] Task 4: Update `packages/auth/src/convex-runtime/native/types.ts`
  - Acceptance: `NativeEmailAndPasswordComponentHandle` includes `native.codes` and `NativeEmailAndPasswordActions` includes the four new actions.
  - Verify: `pnpm run typecheck` passes.

- [ ] Task 5: Add `sendEmailVerification` and `verifyEmail` to `packages/auth/src/convex-runtime/native/provider.ts`
  - Acceptance: actions generate tokens, store hashes, send email via callback, and verify email.
  - Verify: `provider.test.ts` covers both happy and expired-token paths.

- [ ] Task 6: Add `sendPasswordReset` and `resetPassword` to `packages/auth/src/convex-runtime/native/provider.ts`
  - Acceptance: actions generate tokens, send email, and update the account credential hash.
  - Verify: `provider.test.ts` covers happy, expired, and wrong-token paths.

### Phase 4: Client hooks

- [ ] Task 7: Update `packages/react/src/ConvexAuthProvider.tsx`
  - Acceptance: `NativeAuthActions` and `useAuthActions` expose `sendEmailVerification`, `verifyEmail`, `sendPasswordReset`, `resetPassword`.
  - Verify: `packages/react` typecheck passes and tests (if any) pass.

### Phase 5: Integration and proof

- [ ] Task 8: Run full proof
  - Acceptance: `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm test`, `pnpm run check` all pass.
  - Verify: all commands exit 0.

## Risks and mitigations

| Risk                                     | Impact | Mitigation                                                                     |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Token hash timing leaks                  | High   | Use `crypto.timingSafeEqual` and ensure both operands are same-length buffers. |
| Plaintext token logged                   | High   | Never log or return the raw token outside the email callback.                  |
| Email sender not configured              | Med    | Actions return `not_configured` status and tests use mock senders.             |
| Schema migration in existing deployments | Med    | New table is additive; no existing tables or indexes change.                   |

## Open questions

- Should `signIn` reject unverified emails by default or only when opted in?
- Should `resetPassword` revoke all existing sessions?
- Should we keep both consumed and expired codes for audit, or delete on consumption?
