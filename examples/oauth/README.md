# `examples/oauth`

A runnable Vite + React app that demonstrates Google, GitHub, and Discord OAuth with `convex-auth`.

## Setup

1. Copy `.env.example` to `.env.local` and set `VITE_CONVEX_URL`.
2. Configure OAuth client IDs and secrets in your Convex deployment:

   ```bash
   pnpm dlx convex env set GITHUB_CLIENT_ID '...'
   pnpm dlx convex env set GITHUB_CLIENT_SECRET '...'
   pnpm dlx convex env set GOOGLE_CLIENT_ID '...'
   pnpm dlx convex env set GOOGLE_CLIENT_SECRET '...'
   pnpm dlx convex env set DISCORD_CLIENT_ID '...'
   pnpm dlx convex env set DISCORD_CLIENT_SECRET '...'
   ```

   The `convex/auth.ts` in this example already references those variables.

3. Run:

```bash
pnpm install
pnpm dev
```
