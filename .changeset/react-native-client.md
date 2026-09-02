---
"convex-auth-react": minor
"convex-auth-react-native": minor
---

Add `convex-auth-react/client` subpath and Expo native auth provider.

- `convex-auth-react/client` exposes `ConvexAuthProvider`, `useAuthActions`, and all auth types without pulling in the UI or `react-dom`.
- `useAuthActions` now returns `setToken`, `setRefreshToken`, and `setSessionId` for external session management.
- `convex-auth-react-native` adds `ExpoConvexAuthProvider` with Expo SecureStore-backed persistence, deep-link token parsing, and a `subscribeToUrl` hook for live deep links.
