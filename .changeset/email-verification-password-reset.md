---
"convex-auth": minor
"convex-auth-react": minor
---

Add native email verification and password reset

- New `authVerificationCodes` table stores hashed, time-limited, one-time tokens.
- Added `sendEmailVerification`, `verifyEmail`, `sendPasswordReset`, and `resetPassword` actions to `nativeEmailAndPassword`.
- `ConvexAuthProvider` exposes the new actions through `useAuthActions`.
