# Plan: Feature-gated `convexAuth` schema registration

See `SPEC-84-feature-gated-schema.md` for the full specification.

## Phase 1: Core component split

- [ ] Move `packages/auth/src/component/` tables/modules to `packages/auth/src/component/core/`.
- [ ] Create `packages/auth/src/component/core/convex.config.ts` and `packages/auth/src/component/core/schema.ts`.
- [ ] Preserve the existing `packages/auth/src/component/convex.config.ts` and `packages/auth/src/component/schema.ts` as the `full` component (backward-compatible).
- [ ] Update `packages/auth/vite.config.ts` and `packages/auth/package.json` exports for `convex-auth/convex.config` and `convex-auth/convex.config/core`.
- [ ] Verify `pnpm test` still passes with the `full` component.

## Phase 2: Runtime `components` API

- [ ] Update `ConvexAuthConfig` to accept `components: { core: ...; organizations?: ...; apiKeys?: ...; ... }` in addition to the legacy `component`.
- [ ] Update `convexAuth()` to route actions to the appropriate component handle.
- [ ] Type-test that missing component handles remove the corresponding runtime actions.

## Phase 3: Add-on components

- [ ] Create separate component directories for `organizations`, `apiKeys`, `servicePrincipals`, `agentAuth`, `authMd`, `webhooks`, `mcpOauth`.
- [ ] Each component has its own `convex.config.ts` and `schema.ts`.
- [ ] Export them as package subpaths (e.g., `convex-auth/convex.config/organizations`).

## Phase 4: Minimal consumer test

- [ ] Add a test consumer or test setup that uses only `core` + `oauth` components.
- [ ] Verify the consumer schema does not include disabled feature tables.

## Phase 5: Documentation and migration

- [ ] Update `docs/` to show the new opt-in component registration.
- [ ] Add migration notes for existing full-schema consumers.
