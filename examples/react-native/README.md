# `examples/react-native`

A runnable React Native example that builds and runs in the browser via `react-native-web` and Vite. The same `src/App.tsx` code can be dropped into an Expo or React Native CLI project.

## Setup

1. Set `EXPO_PUBLIC_CONVEX_URL` in `.env.local`.
2. Run:

```bash
pnpm install
pnpm dev
```

For a native iOS/Android build, create an Expo project with `pnpm create expo`, add `convex-auth-react-native`, and copy `src/App.tsx` into your app root.
