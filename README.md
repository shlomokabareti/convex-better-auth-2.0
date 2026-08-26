# convex-better-auth-2.0

Public workspace for a full-stack Convex + Better Auth solution.

This repo extracts the auth, React, and React Native layers into four independently buildable, Apache-2.0 packages:

- `packages/better-auth` — `convex-better-auth`: Better Auth runtime bridge for Convex.
- `packages/auth` — `convex-auth`: Convex component, scopes, organizations, API keys, webhooks, MCP, waitlist, and agent-auth protocol.
- `packages/react` — `convex-auth-react`: React UI and hooks for the above.
- `packages/react-native` — `convex-auth-react-native`: React Native / Expo client and forms.

All packages build with `pnpm build`. They have no remaining dependencies on private Vortex packages.

## Build

```bash
pnpm install
pnpm build
```

## Packages

| Package | Path | Description |
|---|---|---|
| `convex-better-auth` | `packages/better-auth` | Better Auth ↔ Convex bridge |
| `convex-auth` | `packages/auth` | Convex auth component + control plane |
| `convex-auth-react` | `packages/react` | React UI and hooks |
| `convex-auth-react-native` | `packages/react-native` | Expo / React Native client |

## License

Apache-2.0 — see `LICENSE`.
