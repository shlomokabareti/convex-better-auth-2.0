# Spec: Convex-first client (web)

## Objective

Move the default `convex-auth-react` runtime from the Better Auth client (`better-auth-runtime.tsx` / `convex-better-auth-adapter/react`) to the native `ConvexAuthProvider` + `useAuthActions` hooks built on `convex/react`. Web is the first target; mobile (`convex-auth-react-native`) follows after the web contract is stable.

The Better Auth client surface (`ConvexBetterAuthClient`) remains available through `convex-auth/better-auth` and `convex-better-auth-adapter/react` for migration, but the default exported provider, forms, and hooks must not require it.

## Assumptions

- `packages/auth/src/convex-runtime/native` is production-ready for email/password, OAuth (Google/GitHub/Discord), magic link, email OTP, TOTP, sessions, and password reset.
- `convex-auth-react` already contains a native `ConvexAuthProvider` and `useAuthActions`.
- Existing consumer apps cast the client to `ConvexBetterAuthClient`; we must not break that type, only change the default implementation.
- Mobile (React Native) is explicitly out of scope for this milestone; we will not change `packages/react-native` except to keep it compiling.

## Tech stack

- React 19
- `convex/react` (`useAction`, `useMutation`, `useQuery`, `useConvex`)
- `convex-auth` native actions/queries
- Vitest + `convex-test`

## Commands

- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Test: `pnpm test`
- Lint/format: `pnpm run check` and `pnpm run check --fix`
- Convex dev: `pnpm exec convex dev --once` (for consumer fixtures)

## Project structure

- `packages/react/src/` — current code
  - `ConvexAuthProvider.tsx` — native provider (existing, source of truth)
  - `useAuthActions.ts` — to be created; wraps `useAction` calls into the `ConvexBetterAuthClient` shape so existing forms can switch with a single import
  - `better-auth-runtime.tsx` — migration/legacy runtime, mark re-exports deprecated but do not delete
  - `better-auth-app-runtime.tsx` — migration app runtime, keep for existing consumers
  - `convex-*-form.tsx` — port to native hooks one by one
  - `auth-flow.tsx`, `auth-pages.tsx` — port orchestration pages last
- `packages/react/src/index.ts` — default exports move to native; legacy exports kept under explicit paths

## Code style

- Never `any`; use `unknown` and narrow.
- Keep Better Auth method signatures where possible to avoid breaking consumer type casts.
- The native client is a thin facade over `useAuthActions`; it does not own state beyond what `ConvexAuthProvider` already owns.

## Testing strategy

- Add `packages/react/src/convex-runtime.test.tsx` (or `.test.ts` for pure hook tests) that verifies the native client methods (`signIn.email`, `signUp.email`, `signIn.social`, `signOut`, `useSession`, etc.) call the correct Convex actions.
- Keep `better-auth-client-contract.test.ts` green so real `better-auth` clients still type-check against `ConvexBetterAuthClient`.
- Add a packaging test that the default `packages/react/dist/index.js` does not include `better-auth` or `convex-better-auth-adapter`.

## Boundaries

- Always do: keep `convex-better-auth` and `convex-better-auth-adapter` packages intact; keep the migration path.
- Ask first: removing a public `convex-auth-react` export or changing the `ConvexBetterAuthClient` type.
- Never do: delete the Better Auth runtime or force existing consumers to migrate immediately.

## Success criteria

- [ ] `convex-auth-react` exports a native `ConvexAuthClient` that can replace the Better Auth client for new apps.
- [ ] At least the sign-in, sign-up, forgot-password, reset-password, verify-email, and email-OTP forms use the native client.
- [ ] `pnpm run typecheck && pnpm run check && pnpm run build && pnpm test` passes.
- [ ] The default `dist/index.js` of `convex-auth-react` has no `better-auth` or `convex-better-auth-adapter` strings.
- [ ] Existing `convex-better-auth` consumer contract test still passes.

## Open questions

- Should the native client keep the `{ data, error }` response shape of Better Auth, or adopt a simpler shape and make the forms resilient to both?
- Should we preserve the `AuthRuntimeProvider` observability/status API, or is `useConvex` + `useAuthActions` enough?
