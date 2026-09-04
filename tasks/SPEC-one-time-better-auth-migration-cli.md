# Spec: One-time Better Auth to `convex-auth` migration CLI

## Objective

Give consumers a single local command that migrates their Better Auth data into the native `convex-auth` tables and then cuts their application over to the native runtime. After running the command, the consumer should be able to remove `better-auth`, `convex-better-auth`, and `convex-better-auth-adapter` from their dependencies.

Primary user: an existing `convex-better-auth` / `convex-better-auth-adapter` consumer who has already mounted the `convex-auth` component and is ready to switch.

## Tech stack

- CLI entry: `packages/auth/scripts/cli.ts` (already exposes `convex-auth` binary).
- New subcommand: `migrate better-auth`.
- Runtime: Node 18+, `tsx`/`node` for local scripts, `convex` CLI for deployment-aware queries/mutations.
- Migration execution: reuse existing `convex-auth` component mutations (`packages/auth/src/component/migrate.ts`) and the `@convex-dev/migrations` runner in `convex-better-auth-adapter` (`packages/better-auth-adapter/src/component/migrate.ts`).
- File modifications: codemod-style string/template rewrites of consumer `convex/auth.ts`, `convex/http.ts`, React entry files, and `package.json`.

## Assumptions I'm making

1. The consumer already has both the `better-auth-adapter` component and the `convex-auth` component mounted in the same Convex deployment.
2. The legacy tables live in the `better-auth-adapter` component (`user`, `account`, `session`, `verification`, `twoFactor`, etc.).
3. The migration is one-way and idempotent: rerunning the data migration must not duplicate already-migrated users/accounts/sessions.
4. The CLI does **not** need to migrate OAuth application/provider metadata (those remain in the adapter or are exported separately).
5. Cutover file edits are best-effort codemods; consumers must review the diff before committing.
6. The CLI runs locally against a Convex deployment the user has already authenticated with (`CONVEX_DEPLOYMENT` or `npx convex login`).

→ Correct me now or I'll proceed with these.

## Commands

```bash
# Dry-run data migration and print a report.
pnpm dlx convex-auth migrate better-auth --dry-run

# Run the one-time data migration.
pnpm dlx convex-auth migrate better-auth

# Run migration + cutover file edits in one pass.
pnpm dlx convex-auth migrate better-auth --cutover

# Resume an interrupted migration from the last cursor.
pnpm dlx convex-auth migrate better-auth --resume

# Limit batch/page size for large deployments.
pnpm dlx convex-auth migrate better-auth --batch-size 100

# Print help.
pnpm dlx convex-auth migrate better-auth --help
```

## Project structure

```
packages/auth/
  scripts/
    cli.ts              # add `migrate` subcommand routing
    migrate-better-auth.ts   # orchestration script
  src/
    convex-runtime/
      native/
        migrate.ts      # existing per-doc migration mutations (migrateUser, migrateAccount, migrateSession)
packages/better-auth-adapter/
  src/component/
    migrate.ts          # existing @convex-dev/migrations runner wiring
```

## High-level approach

1. **Discovery** — list the legacy `user`, `account`, and `session` tables in the `better-auth-adapter` component, plus counts.
2. **Target setup** — ensure the `better-auth-adapter` `migrationConfig` points to the `convex-auth` `migrateUser`, `migrateAccount`, and `migrateSession` mutations.
3. **Data migration** — invoke `migrateAll` (or equivalent) in the adapter component, paginating through users → accounts → sessions and writing to `convex-auth` tables.
4. **Validation** — compare counts and sample a few users/identities/sessions for consistency.
5. **Cutover** (when `--cutover` is passed):
   - Rewrite `convex/auth.ts` to import from `convex-auth/convex` and call `convexAuth({ component, ... })`.
   - Ensure `convex/http.ts` calls `auth.addHttpRoutes(http)`.
   - Rewrite web React entry to use `ConvexAuthProvider` from `convex-auth/react`.
   - Rewrite Expo entry to use `ExpoConvexAuthProvider` from `convex-auth/react-native`.
   - Remove `better-auth`, `@better-auth/expo`, `convex-better-auth`, and `convex-better-auth-adapter` from `package.json`.
6. **Report** — print counts migrated, files changed, and next manual steps.

## Code style

- Add subcommands by extending the `switch` in `scripts/cli.ts`, mirroring `check` and `preflight`.
- Keep orchestration logic in `scripts/migrate-better-auth.ts` and thin wrappers in `cli.ts`.
- Use `convex` CLI programmatically or call `convex run` via `spawn`; avoid inventing a second HTTP client.
- Codemods are deterministic string rewrites with `fs` and template literals, not AST parsing, unless we already depend on a transform library.

## Testing strategy

- Unit tests for each codemod function in `packages/auth/src/scripts/migrate-better-auth.test.ts` (or similar).
- Integration test in `packages/bridge-consumer` that runs the migration script against a test deployment (or a `convexTest` harness) and asserts users/identities/sessions are migrated.
- Manual verification on `packages/conformance-consumer` before release.

## Boundaries

- **Always:** validate that `convex-auth` component is mounted before mutating data; fail fast with a clear error.
- **Always:** make data migration idempotent and resumable.
- **Always:** keep the CLI surface minimal — one command, a few flags.
- **Ask first:** changing the `better-auth-adapter` schema or runtime API.
- **Ask first:** adding a new runtime dependency to `packages/auth`.
- **Never:** delete legacy data automatically. The CLI reports leftover tables; deletion is manual.
- **Never:** commit secrets or deployment URLs.

## Success criteria

- `pnpm dlx convex-auth migrate better-auth --dry-run` prints table counts without writing anything.
- `pnpm dlx convex-auth migrate better-auth` migrates all legacy users, accounts, and sessions into `users`, `auth_identities`, `authAccounts`, and `authSessions`.
- Rerunning the migration completes without duplicates.
- `--cutover` produces the expected file edits for `convex/auth.ts`, `convex/http.ts`, `src/main.tsx` (or `App.tsx`), and `package.json`.
- After cutover, a consumer can `pnpm remove better-auth convex-better-auth convex-better-auth-adapter` and sign in with native `convex-auth` using existing data.

## Open questions

1. Should the CLI support migrating from `@convex-dev/better-auth` directly, or only from the vendored `convex-better-auth-adapter`?
2. Should `--cutover` edit files in place or generate a `.migration/` patch directory for review?
3. Do we need to preserve active sessions across cutover, or is it acceptable to require users to sign in again?
4. Should the migration runner live entirely inside `convex-auth` (new mutations) or continue using the `better-auth-adapter` `migrateAll` runner?
5. What is the target consumer for the first manual test — `packages/bridge-consumer`, `packages/conformance-consumer`, or a fresh test app?
