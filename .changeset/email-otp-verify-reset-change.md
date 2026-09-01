---
"convex-auth": minor
"convex-auth-react": minor
---

Add Better Auth-compatible email OTP flows for verification, password reset, and email change.

The `nativeEmailOtp` runtime now exposes a single `sendVerificationOtp`/`verifyEmailOtp` action pair that supports `sign-in`, `email-verification`, `forget-password`, and `change-email` types. `verifyEmailOtp` for `sign-in` returns a session; other types return the corresponding `success`/`status` result. The component gains an `identity.changeEmail` mutation and a new `email_change` verification code type to support authenticated email updates. The React provider adds a generic `sendVerificationOtp` hook while preserving the existing `signInWithEmailOtp`/`verifyEmailOtp` surface.
