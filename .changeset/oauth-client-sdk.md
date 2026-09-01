---
"convex-auth-react": minor
---

Expose native OAuth client helpers in `ConvexAuthProvider`.

`useAuthActions` now returns `signInWithRedirect` and `oauthCallback` when the runtime is configured for OAuth. `signInWithRedirect` calls the native `signInWithRedirect` action and returns the provider authorization URL. `oauthCallback` calls the native `callback` action and, on success, updates the stored token, refresh token, and session ID.
