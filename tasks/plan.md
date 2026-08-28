# Plan: Milestone 3 catch-up — Better Auth OAuth parity

## Module map

| Module                                           | Responsibility                              | Depends on                                      |
| ------------------------------------------------ | ------------------------------------------- | ----------------------------------------------- |
| `packages/auth/src/convex-runtime/native/oauth.ts`          | Add provider options (`prompt`, `accessType`, `hd`, etc.) and token types | —                                               |
| `packages/auth/src/convex-runtime/native/oauthState.ts`     | Add `requestSignUp`, `link`, `additionalData` to state     | —                                               |
| `packages/auth/src/convex-runtime/native/oauthHandlers.ts`  | Add linking policy, signup control, token storage, error codes | `oauthState`, `oauth`, component account schema |
| `packages/auth/src/convex-runtime/native/oauthHttp.ts`      | Parse new query params, set better cookies, map errors     | `oauthHandlers`                                 |
| `packages/auth/src/convex-runtime/native/oauthActions.ts`   | Accept new args and pass to handlers                       | `oauthHandlers`                                 |
| `packages/auth/src/component/native/accounts.ts`            | Add token storage fields and `updateAccountTokens`         | schema                                          |
| `packages/auth/src/component/schema.ts`                     | Add nullable token fields to `authAccounts`                | —                                               |
| `packages/auth/src/convex-runtime/native/oauth.test.ts`     | Add parity tests                                           | all above                                       |

## Build order

1. [ ] Extend `authAccounts` schema and component functions for token storage.
2. [ ] Add provider options and token fields to `NativeOAuthConfig`/`GitHubProviderConfig`/`GoogleProviderConfig`.
3. [ ] Extend `OAuthStatePayload` and `handleSignIn` to carry/parse `requestSignUp`, `link`, `additionalData`.
4. [ ] Implement account linking policy in `handleCallback`.
5. [ ] Implement `disableSignUp`, `disableImplicitSignUp`, `requireEmailVerification`.
6. [ ] Persist provider tokens on the account.
7. [ ] Implement specific error redirects and cookie shape.
8. [ ] Upgrade Google provider to verify `id_token` and accept auth-URL options.
9. [ ] Run full proof.
10. [ ] Commit, push, PR.
