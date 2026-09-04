# Spec: One-time Better Auth to `convex-auth` migration CLI

## Objective

Give consumers a single local command that migrates their Better Auth data into the native `convex-auth` tables and then cuts their application over to the native runtime. After running the command, the consumer should be able to remove `better-auth`, `@convex-dev/better-auth`, and any bridge packages from their dependencies.

Primary user: an existing `@convex-dev/better-auth` consumer who has already mounted the `convex-auth` component and is ready to switch.

## Tech stack

- CLI entry: `packages/auth/scripts/cli.ts` (already exposes `convex-auth` binary).
- New subcommand: `migrate better-auth`.
- Runtime: Node 18+, `tsx`/`node` for local scripts, `convex` CLI for deployment-aware queries/mutations.
- Migration execution: the CLI generates a one-time consumer action (e.g., `convex/betterAuthMigrate.ts`) that reads from the legacy `betterAuth` component and calls the existing `convex-auth` component migration mutations (`packages/auth/src/component/migrate.ts`). The consumer action is removed after the migration.
- File modifications: codemod-style string/template rewrites of consumer `convex/auth.ts`, `convex/http.ts`, `convex/convex.config.ts`, React entry files, and `package.json`.

## Assumptions I'm making

1. The consumer already has both the `@convex-dev/better-auth` component and the `convex-auth` component mounted in the same Convex deployment. The same flow also works for the vendored `convex-better-auth-adapter` component because the table shape is identical.
2. The legacy tables live in the `@convex-dev/better-auth` component (`user`, `account`, `session`, `verification`, `twoFactor`, etc.).
3. The migration is one-way and idempotent: rerunning the data migration must not duplicate already-migrated users/accounts/sessions.
4. The CLI does **not** need to migrate OAuth application/provider metadata (those remain in the legacy component or are exported separately).
5. Cutover file edits are best-effort codemods; consumers must review the diff before committing.
6. The CLI runs locally against a Convex deployment the user has already authenticated with (`CONVEX_DEPLOYMENT` or `pnpm dlx convex login`).
7. Because a Convex component cannot read another component's tables directly, the CLI will generate a short-lived consumer action that orchestrates the migration.

→ Correct me now or I'll proceed with these.

## Commands

```bash
# Dry-run data migration and print a report.
pnpm dlx convex-auth migrate better-auth --dry-run

# Run the one-time data migration (default legacy component is `betterAuth`).
pnpm dlx convex-auth migrate better-auth

# Migrate from a vendored adapter mounted under a different name.
pnpm dlx convex-auth migrate better-auth --from-component betterAuthAdapter

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
    migrate-better-auth.ts   # orchestration script; generates consumer action, runs it, cleans it up
  src/
    convex-runtime/
      native/
        migrate.ts      # existing per-doc migration mutations (migrateUser, migrateAccount, migrateSession)
  templates/
    better-auth-migrate.ts   # consumer action template with placeholders for the legacy component name
```

## High-level approach

1. **Discovery** — detect the legacy component mount name and print counts for its `user`, `account`, and `session` tables.
2. **Codegen** — write a temporary consumer action (from `packages/auth/templates/better-auth-migrate.ts`) that paginates through the legacy component and calls `convex-auth` `migrateUser`, `migrateAccount`, and `migrateSession` mutations.
3. **Data migration** — `pnpm dlx convex run betterAuthMigrate:migrate` (or equivalent) to execute the generated action, which paginates users → accounts → sessions and writes to `convex-auth` tables.
4. **Cleanup** — delete the temporary consumer action file.
5. **Validation** — compare counts and sample a few users/identities/sessions for consistency.
6. **Cutover** (when `--cutover` is passed):
   - Rewrite `convex/convex.config.ts` to mount only `convex-auth` and drop the legacy component.
   - Rewrite `convex/auth.ts` to import from `convex-auth/convex` and call `convexAuth({ component, ... })`.
   - Ensure `convex/http.ts` calls `auth.addHttpRoutes(http)`.
   - Rewrite web React entry to use `ConvexAuthProvider` from `convex-auth/react`.
   - Rewrite Expo entry to use `ExpoConvexAuthProvider` from `convex-auth/react-native`.
   - Remove `better-auth`, `@better-auth/expo`, and `@convex-dev/better-auth` (or bridge packages) from `package.json`.
7. **Report** — print counts migrated, files changed, and next manual steps.

## Code style

- Add subcommands by extending the `switch` in `scripts/cli.ts`, mirroring `check` and `preflight`.
- Keep orchestration logic in `scripts/migrate-better-auth.ts` and thin wrappers in `cli.ts`.
- Generate the consumer action by interpolating a template file (`packages/auth/templates/better-auth-migrate.ts`) rather than building strings in code.
- Use `convex` CLI programmatically via `spawn` for `run`, `dev --once`, and `codegen`; avoid inventing a second HTTP client.
- Codemods are deterministic string rewrites with `fs` and template literals, not AST parsing, unless we already depend on a transform library.

## Testing strategy

- Unit tests for each codemod and template function in `packages/auth/src/scripts/migrate-better-auth.test.ts`.
- Integration test in `packages/bridge-consumer` (which already mounts the legacy adapter) that runs the migration script and asserts users/identities/sessions are migrated.
- Manual verification on `packages/conformance-consumer` before release.

## Boundaries

- **Always:** validate that `convex-auth` component is mounted and that the requested legacy component exists before generating the migration action.
- **Always:** make data migration idempotent and resumable.
- **Always:** keep the CLI surface minimal — one command, a few flags.
- **Ask first:** changing the `convex-auth` migration mutation signatures.
- **Ask first:** adding a new runtime dependency to `packages/auth`.
- **Never:** delete legacy data automatically. The CLI reports leftover tables; deletion is manual.
- **Never:** commit the temporary generated consumer action. It must be removed after the migration.

## Success criteria

- `pnpm dlx convex-auth migrate better-auth --dry-run` prints table counts and the generated migration action path without writing anything.
- `pnpm dlx convex-auth migrate better-auth` migrates all legacy users, accounts, and sessions into `users`, `auth_identities`, `authAccounts`, and `authSessions`.
- `pnpm dlx convex-auth migrate better-auth --from-component betterAuthAdapter` works for vendored `convex-better-auth-adapter` consumers.
- Rerunning the migration completes without duplicates.
- `--cutover` produces the expected file edits for `convex/convex.config.ts`, `convex/auth.ts`, `convex/http.ts`, `src/main.tsx` (or `App.tsx`), and `package.json`.
- After cutover, a consumer can `pnpm remove better-auth @convex-dev/better-auth` (or bridge packages) and sign in with native `convex-auth` using existing data.

## Open questions

1. ~~Should the CLI support migrating from `@convex-dev/better-auth` directly, or only from the vendored `convex-better-auth-adapter`?~~ **Resolved: direct `@convex-dev/better-auth` is the primary source; the same template works for `convex-better-auth-adapter` via `--from-component`.**
2. Should `--cutover` edit files in place or generate a `.migration/` patch directory for review? *(Default: in-place with a pre-flight diff prompt; can be overridden with `--no-apply` to print the diff.)*
3. Do we need to preserve active sessions across cutover, or is it acceptable to require users to sign in again? *(Default: sessions are migrated into `authSessions`, but existing Better Auth tokens are not valid for the native JWTs, so users will be required to sign in again.)*
4. What is the target consumer for the first manual test — `packages/bridge-consumer`, `packages/conformance-consumer`, or a fresh test app? *(Default: `packages/bridge-consumer` because it already mounts the legacy adapter and `convex-auth`.)*
