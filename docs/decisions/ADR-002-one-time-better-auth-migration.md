# ADR-002: One-time Better Auth migration instead of a runtime bridge

## Status

Proposed

## Date

2026-09-03

## Context

`convex-better-auth` and `convex-better-auth-adapter` currently act as a runtime bridge: Better Auth primitives run inside the Convex isolate and translate state into Convex tables on every request. This keeps Better Auth in the bundle and forces consumers to keep the `better-auth` runtime installed while they are supposedly migrating.

The goal is to get consumers completely off Better Auth. A runtime bridge cannot do that because it keeps the dependency alive. A migration, by contrast, copies the data once and then the bridge is uninstalled.

## Decisions

### 1. The bridge becomes a one-time migration

**Decision:** Replace the continuous `convex-better-auth` runtime bridge with a one-time data migration. Consumers run the migration once, verify the data, then remove `convex-better-auth` and `better-auth` from their project.

- The migration lives in `convex-better-auth-adapter` (or a dedicated migration package) and is the only reason to install that package.
- After the migration, `convex-auth` is the only auth runtime.
- `convex-better-auth` will be deprecated and eventually deleted once the migration tool is stable.

### 2. The migration runs inside Convex

**Decision:** The migration is implemented as a Convex action (or set of actions) that reads the legacy Better Auth adapter tables and writes to the native `convex-auth` tables.

- All table translation happens in one project deployment.
- Consumers trigger it via a CLI command (`convex-auth migrate-from-better-auth`) or a single `convex run` command.
- No external ETL pipeline or manual row-by-row export is required.

### 3. Migration is opt-in, idempotent, and reversible before cutover

**Decision:** The migration tool:

- Does not delete legacy rows until the consumer explicitly confirms.
- Can be run multiple times without duplicating native rows.
- Writes to separate `convex-auth` tables so consumers can compare before switching.

## Consequences

- `convex-auth` no longer needs to defend against Better Auth runtime leaks; the bridge is not imported at runtime.
- The `convex-better-auth` runtime packages can be deprecated.
- Migration guides can be simplified to: install the migration tool, run it once, remove the old package.
- A new milestone is needed to implement the migration actions and CLI.

## Related

- Issue #140
- `docs/convex-native-auth-strategy.md`
- `docs/migrating-from-better-auth.md`
