# Plan: Feature-gated `convexAuth` schema registration

See `SPEC-84-feature-gated-schema.md` for the full specification.

## Phase 1: Core component split

- [x] Create `packages/auth/src/component/core/convex.config.ts` and `packages/auth/src/component/core/schema.ts`.
- [x] Preserve the existing `packages/auth/src/component/convex.config.ts` and `packages/auth/src/component/schema.ts` as the `full` component (backward-compatible).
- [x] Update `packages/auth/vite.config.ts` and `packages/auth/package.json` exports for `convex-auth/convex.config` and `convex-auth/convex.config/core`.
- [x] Verify `pnpm test` still passes with the `full` component.

## Phase 2: Add-on component extraction (self-contained)

- [x] Create `organizations` component with `convex.config.ts` and `schema.ts` and prerequisite core tables.
- [x] Create `apiKeys` component with `convex.config.ts`, `schema.ts`, and `apiKeys.ts` and prerequisite users/organizations/service-principal tables.
- [x] Create `servicePrincipals` component with `convex.config.ts`, `schema.ts`, and `servicePrincipals.ts` and prerequisite users/organizations tables.
- [x] Create `agentAuth` component with `convex.config.ts`, `schema.ts`, and `agentAuth.ts` and prerequisite users/organizations tables.
- [x] Create `authMd` component with `convex.config.ts`, `schema.ts`, and `authMd.ts` and prerequisite users/organizations tables.
- [x] Create `webhooks` component with `convex.config.ts`, `schema.ts`, and `webhooks.ts` and prerequisite users/organizations tables.
- [x] Create `mcpOauth` component with `convex.config.ts`, `schema.ts`, and `mcpOauth.ts` (self-contained; no user/org references).
- [x] Export package subpaths and Vite entries for every new component.
- [x] Regenerate all Convex bindings.
- [x] Verify `pnpm test` still passes.

## Phase 3: Runtime `components` API

- [x] Update `ConvexAuthConfig` to accept `components: { core: ... }` in addition to the legacy `component`.
- [x] Update `convexAuth()` to route actions to the core component handle.
- [ ] Update `createConvexAuthOrganizationOperations` to accept `components: { core, organizations, apiKeys }` and route to the right component.
- [ ] Add per-feature operation helpers for `servicePrincipals`, `agentAuth`, `authMd`, `webhooks`, and `mcpOauth` components (or confirm consumers can use the generated component APIs directly).
- [ ] Type-test that `convexAuth()` only accepts compatible component handles as `components.core`.

## Phase 4: Minimal consumer test

- [ ] Add a test consumer or test setup that uses only `core` + `oauth` components.
- [ ] Verify the consumer schema does not include disabled feature tables.

## Phase 5: Documentation and migration

- [ ] Update `docs/` to show the new opt-in component registration.
- [ ] Add migration notes for existing full-schema consumers.
