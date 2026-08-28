# Spec: Google OAuth provider

## Objective

Add a second native OAuth provider (Google) to the `convex-auth` native runtime. This validates that the Milestone 3 handlers and HTTP routes are provider-agnostic and establishes the pattern for adding more providers.

## Assumptions

- Google is the second provider; no other providers are in scope.
- The provider uses the OAuth 2.0 authorization-code flow with PKCE, the same as GitHub.
- Google requires a `client_secret` in the token exchange.
- `email` and `profile` scopes are requested by default; `openid` is included for the `sub` claim.
- No schema changes; `users`, `auth_identities`, `authAccounts`, and `authSessions` are reused.
- Identity `issuer` is `https://accounts.google.com` (OpenID Connect issuer).
- `subject` is the `sub` claim from the ID token / userinfo response.

## Project structure

- `packages/auth/src/convex-runtime/native/oauth.ts` — add `GoogleProviderConfig` and `createGoogleProvider`.
- `packages/auth/src/convex-runtime/native/oauthHandlers.ts` — add `google` to `NativeOAuthConfig` and `getProvider`.
- `packages/auth/src/convex-runtime/native/oauth.test.ts` — add Google provider tests.

## Code style

Same as Milestone 3: vendored provider metadata, `fetch` for token/userinfo, explicit `URLSearchParams`, and explicit field mapping.

## Testing strategy

- Unit tests for provider metadata, authorization URL, token exchange, and userinfo mapping.
- One test exercising the full `handleCallback` flow with a mocked Google server.
- Existing GitHub tests continue to pass.

## Boundaries

- Always: run the focused OAuth test suite and full `pnpm run typecheck && pnpm run check && pnpm run build && pnpm test`.
- Ask first: adding or removing runtime dependencies.
- Never: commit client secrets or real provider credentials.

## Success criteria

1. `createGoogleProvider` returns a `NativeOAuthProvider` with the correct Google endpoints.
2. `GET /api/auth/signin/google` redirects to Google's authorization URL with `state` and PKCE `code_challenge`.
3. `GET /api/auth/callback/google` exchanges the code, fetches userinfo, and provisions a user/session.
4. A new user signing in with Google is provisioned with `provider: "google"`, `issuer: "https://accounts.google.com"`, and `subject` equal to the `sub` claim.
5. All existing GitHub OAuth tests still pass.
6. Full proof is green.

## Open questions

- Should we use `id_token` for userinfo instead of the `userinfo` endpoint? For the first slice, use `userinfo` to mirror the GitHub pattern and fetch verified claims explicitly.
