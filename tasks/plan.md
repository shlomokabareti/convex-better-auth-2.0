# Plan: Milestone 3 — Native GitHub OAuth

## Module map

| Module                                                     | Responsibility                                                                                    | Depends on                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/auth/src/convex-runtime/native/oauth.ts`         | GitHub provider metadata, authorization URL, token exchange, userinfo fetch                       | —                                                    |
| `packages/auth/src/convex-runtime/native/oauthState.ts`    | PKCE `code_verifier`/`code_challenge` and signed `state` JWT with Web Crypto                      | —                                                    |
| `packages/auth/src/convex-runtime/native/oauthHandlers.ts` | Shared handlers: sign-in URL, callback code exchange, identity/session creation                   | `provider`, `pkce`, `identity`, `sessions` component |
| `packages/auth/src/convex-runtime/native/oauthActions.ts`  | Convex `signIn` and `callback` actions                                                            | `oauthHandlers`                                      |
| `packages/auth/src/convex-runtime/native/oauthHttp.ts`     | `Request` → `Response` router for `/api/auth/signin/:provider` and `/api/auth/callback/:provider` | `oauthHandlers`                                      |
| `packages/auth/src/convex-runtime/native/oauth.test.ts`    | Unit + HTTP-level tests with mocked GitHub                                                        | all above                                            |

## Build order

1. [x] `oauth/provider` — define GitHub metadata contract and vendored OAuth endpoints.
2. [x] `oauth/pkce` — implement and test PKCE/state helpers.
3. [x] `oauth/actions` — implement signin/callback handlers and actions.
4. [x] `oauth/http` — wire handlers into HTTP routes.
5. [x] Tests — full flow with mocked GitHub.
6. [x] Proof — typecheck, lint, build, test.
