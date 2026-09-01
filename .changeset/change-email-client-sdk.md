---
"convex-auth-react": minor
---

Add `changeEmail` to `useAuthActions`.

`changeEmail({ newEmail, callbackURL? })` normalizes the new email address and calls `sendVerificationOtp` with `type: "change-email"`, wiring the React client to the `identity.changeEmail` mutation and `email_change` verification code path.
