# Plan: Milestone 3 catch-up — Better Auth OAuth parity

## Module map

| Module                                                     | Responsibility                                                            | Depends on                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/auth/src/convex-runtime/native/oauth.ts`         | Add provider options (`prompt`, `accessType`, `hd`, etc.) and token types | —                                               |
| `packages/auth/src/convex-runtime/native/oauthState.ts`    | Add `requestSignUp`, `link`, `additionalData` to state                    | —                                               |
| `packages/auth/src/convex-runtime/native/oauthHandlers.ts` | Add linking policy, signup control, token storage, error codes            | `oauthState`, `oauth`, component account schema |
| `packages/auth/src/convex-runtime/native/oauthHttp.ts`     | Parse new query params, set better cookies, map errors                    | `oauthHandlers`                                 |
| `packages/auth/src/convex-runtime/native/oauthActions.ts`  | Accept new args and pass to handlers                                      | `oauthHandlers`                                 |
| `packages/auth/src/component/native/accounts.ts`           | Add token storage fields and `updateAccountTokens`                        | schema                                          |
| `packages/auth/src/component/schema.ts`                    | Add nullable token fields to `authAccounts`                               | —                                               |
| `packages/auth/src/convex-runtime/native/oauth.test.ts`    | Add parity tests                                                          | all above                                       |

## Build order

1. [x] Extend `OAuthStatePayload` and `handleSignIn` to carry/parse `requestSignUp`, `link`, `additionalData`.
2. [x] Implement account linking policy in `handleCallback`.
3. [x] Implement `disableSignUp`, `disableImplicitSignUp`, `requireEmailVerification`.
4. [x] Implement specific error redirects and cookie shape.
5. [x] Add Google auth-URL options (`accessType`, `prompt`, `loginHint`, `hd`, `includeGrantedScopes`, `additionalParams`).
6. [ ] Extend `authAccounts` schema and component functions for token storage.
7. [ ] Persist provider tokens on the account.
8. [ ] Verify Google `id_token` against JWKS and use as primary userinfo source.
9. [x] Run full proof.
10. [ ] Commit, push, PR.
