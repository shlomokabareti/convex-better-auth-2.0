# Spec: Feature-gated `convexAuth` schema registration

## Objective

Issue #84. The `convexAuth` component currently installs 30+ tables regardless of which auth features a consumer enables. A consumer who only wants email/password + OAuth still gets organizations, API keys, agent auth, auth-md, webhooks, and MCP OAuth tables.

We will split the monolithic `convexAuth` component into feature-scoped components that a consumer can `app.use()` independently, while keeping `convex-auth` a single package and `convexAuth()` a single runtime entry point.

## Tech stack

- Convex components (`defineComponent`, `app.use`)
- TypeScript
- `vite-plus` for packaging
- Existing `packages/auth/src/component/schema/` modules

## Assumptions

1. Backward compatibility: a `convex-auth/convex.config` "full" component will still exist so existing consumers do not break.
2. `convexAuth()` will accept either the legacy single `component` handle OR a new `components` object with per-feature handles.
3. Core tables (`users`, `auth_identities`, `authAccounts`, `authSessions`, `authRefreshTokens`, `authVerificationCodes`, `authVerifiers`, `authRateLimits`, `authMagicLinkTokens`) are required by any auth feature and live in a `convexAuthCore` component.
4. Organizations and API keys can be independently enabled/disabled.
5. Agent auth, auth-md, webhooks, MCP OAuth, and service principals are independent add-on components.

## Capability map / build order

| Module            | Responsibility                                                                          | Tables                                                                                                                                           | Depends on |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| core              | users, identities, sessions, codes, verifiers, accounts, magic link tokens, rate limits | users, auth_identities, authAccounts, authSessions, authRefreshTokens, authVerificationCodes, authVerifiers, authRateLimits, authMagicLinkTokens | —          |
| organizations     | orgs, roles, members, invitations                                                       | organizations, organization_roles, organization_members, organization_invitations                                                                | core       |
| apiKeys           | machine API keys and audit events                                                       | api_keys, auth_audit_events                                                                                                                      | core       |
| servicePrincipals | service-to-service principals                                                           | service_principals                                                                                                                               | core       |
| agentAuth         | agent hosts, devices, grants, audit                                                     | agent\_\* tables                                                                                                                                 | core       |
| authMd            | metadata registrations/assertions/credentials                                           | auth*md*\*                                                                                                                                       | core       |
| webhooks          | webhook endpoints and deliveries                                                        | webhook_endpoints, webhook_deliveries                                                                                                            | core       |
| mcpOauth          | MCP OAuth clients/codes/tokens                                                          | mcp*oauth*\*                                                                                                                                     | core       |

Build order: core → organizations, apiKeys, servicePrincipals → agentAuth, authMd, webhooks, mcpOauth

## Commands

- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Test: `pnpm test`
- Lint: `pnpm run lint`
- PRC: `pnpm dlx --package @marinjursic/prc --package @marinjursic/prc-linux-x64 prc quick`

## Project structure

- `packages/auth/src/component/core/` — core component (`convex.config.ts`, `schema.ts`, runtime modules copied from current `component/`)
- `packages/auth/src/component/organizations/` — organizations component
- `packages/auth/src/component/apiKeys/` — api keys component
- `packages/auth/src/component/servicePrincipals/` — service principals component
- `packages/auth/src/component/agentAuth/` — agent auth component
- `packages/auth/src/component/authMd/` — auth-md component
- `packages/auth/src/component/webhooks/` — webhooks component
- `packages/auth/src/component/mcpOauth/` — MCP OAuth component
- `packages/auth/src/component/full/` — full component that re-exports all the above for backward compatibility
- `packages/auth/src/convex-runtime/native/convexAuth.ts` — updated to accept `components` object and route to per-feature components

## Code style

- Keep current module naming (`native/`, `organizations/`, etc.).
- Each component has its own `convex.config.ts` and `schema.ts`.
- Public types live in `packages/auth/src/convex.ts`.
- No `any`; use `unknown` and narrow.

## Testing strategy

1. Existing tests in `packages/auth` must continue to pass with the `full` component.
2. New test consumer in `packages/conformance-consumer` or `packages/auth` tests should configure a minimal core-only component.
3. Type-tests ensure `convexAuth()` only exposes actions whose components are supplied.
4. CI: typecheck + lint + build + test + prc.

## Boundaries

- Always: keep tests green, preserve public API, run proof before commit.
- Ask first: changing package export map, removing a component, public API break.
- Never: delete existing tables without migration path, hand-roll schema gating logic that Convex already provides.

## Success criteria

1. `packages/auth` builds a `convex-auth/convex.config` full component that is backward-compatible.
2. `convex-auth/convex.config/core` and other subpaths exist and can be `app.use()`d independently.
3. `convexAuth()` accepts a `components` object and only exposes actions for components present.
4. `pnpm test` and `prc quick` pass.
5. Consumer contract and preflight checks still pass.

## Open questions

1. Should the legacy single `component` argument be deprecated or kept indefinitely?
2. Does Convex support a single `convexAuth()` function accepting multiple component handles cleanly, or do we need a builder/factory pattern?
3. What is the migration path for consumers who already have the full schema deployed? (Convex does not drop tables on schema removal.)
