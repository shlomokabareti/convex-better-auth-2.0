# Plan: Milestone 4 slice — Google OAuth

## Module map

| Module                                                     | Responsibility                                           | Depends on                     |
| ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `packages/auth/src/convex-runtime/native/oauth.ts`         | Add `GoogleProviderConfig` and `createGoogleProvider`    | —                              |
| `packages/auth/src/convex-runtime/native/oauthHandlers.ts` | Wire `google` into `NativeOAuthConfig` and `getProvider` | `oauth.ts`                     |
| `packages/auth/src/convex-runtime/native/oauth.test.ts`    | Add Google provider and full-flow tests                  | `oauth.ts`, `oauthHandlers.ts` |

## Build order

1. [ ] Implement `createGoogleProvider` with Google metadata, token exchange, and userinfo fetch.
2. [ ] Update `NativeOAuthConfig` and `getProvider` to support `google`.
3. [ ] Add Google tests, including mocked token/userinfo endpoints.
4. [ ] Run full proof.
5. [ ] Commit, push, and PR.
