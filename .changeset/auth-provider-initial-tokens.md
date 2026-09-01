---
"convex-auth-react": minor
---

Add `initialToken`, `initialRefreshToken`, and `initialSessionId` props to `ConvexAuthProvider`.

This lets non-browser consumers (e.g., React Native with `expo-linking`) seed the session from a deep-link or other external source instead of relying on `window.location.search`.
