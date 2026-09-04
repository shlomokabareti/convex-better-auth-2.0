# `examples/oauth`

A runnable Vite + React app that demonstrates Google, GitHub, and Discord OAuth with `convex-auth`.

## Setup

1. Set `VITE_CONVEX_URL` in `.env.local`.
2. Configure OAuth client IDs and secrets in your Convex deployment (`convex/auth.ts` already references `GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_ID`, and `DISCORD_CLIENT_ID`).
3. Run:

```bash
pnpm install
pnpm dev
```
