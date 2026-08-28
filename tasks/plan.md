# Plan: Milestone 1 & 2 catch-up — Better Auth email/password parity

## Module map

| Module                                                     | Responsibility                                            | Depends on                    |
| ---------------------------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| `packages/auth/src/convex-runtime/native/password.ts`      | argon2id hashing, legacy scrypt compatibility             | —                             |
| `packages/auth/src/convex-runtime/native/provider.ts`      | sign-up/sign-in/sign-out, verification, reset actions     | `password`, `tokens`, `jwt`   |
| `packages/auth/src/convex-runtime/native/jwt.ts`           | honour session TTL / rememberMe in token expiry           | `process.env.JWT_PRIVATE_KEY` |
| `packages/auth/src/convex-runtime/native/sessions.ts`      | `verifySession` query, JWKS query                         | `jwt`                         |
| `packages/auth/src/convex-runtime/native/http.ts`          | `/.well-known/jwks.json`, reset callback, verify redirect | `sessions`                    |
| `packages/react/src/ConvexAuthProvider.tsx`                | expose new client args/results                            | `provider` types              |
| `packages/auth/src/convex-runtime/native/provider.test.ts` | updated and new parity tests                              | all above                     |

## Build order

1. [ ] Add `argon2` hashing with legacy scrypt fallback in `password.ts`.
2. [ ] Add configurable `minPasswordLength` / `maxPasswordLength` and `name`/`email` validation to `signUp` and `resetPassword`.
3. [ ] Return `user` object from `signUp` and `signIn`; update types and client.
4. [ ] Add `rememberMe` support and make `mintToken`/`createSession` honour TTL.
5. [ ] Add `disableSignUp`/`enabled` gating, timing mitigation, and sign-up email verification trigger.
6. [ ] Add `verifySession` query and `/.well-known/jwks.json` route.
7. [ ] Add password reset GET callback and `redirectTo` support; remove auto-sign-in from `resetPassword`.
8. [ ] Add `callbackURL` support to `sendEmailVerification` and `verifyEmail`.
9. [ ] Update `ConvexAuthProvider` and `useAuthActions`.
10. [ ] Run full proof and open PR.
