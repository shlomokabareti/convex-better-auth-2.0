<div align="center">

# convex-better-auth-2.0

A public, full-stack auth solution that bridges [Convex](https://convex.dev) and [Better Auth](https://www.better-auth.com).

[![CI][ci-badge]][ci]
[![Docs][docs-badge]][docs]
[![License][license-badge]][license]
[![Status][status-badge]][status]
[![Node][node-badge]][node]
[![pnpm][pnpm-badge]][pnpm]

**[Docs](https://gregarious-perch-710.convex.site)** · **[Why this exists](#why-this-exists)** · **[Packages](#packages)** · **[Quick start](#quick-start)**

</div>

---

## Status

Public — `convex-auth` is at `1.2.0` and the Better Auth 1.7 adapter is at `0.13.0`. The Convex-native runtime (email/password, Google/GitHub/Discord OAuth, TOTP 2FA, backup codes, trusted devices, sessions, and refresh tokens) is passing full conformance and is ready for alpha use. The adapter remains pre-1.0 while the community validates it against Better Auth releases.

## Why this exists

Convex is building the future of auth, but it is not there yet. Better Auth has the most complete feature set today, but it is not designed around Convex's component, query, and mutation model. Most teams who try to combine the two end up rewriting the same glue and making the same security mistakes.

This repo is the pragmatic middle path:

1. **Convex Auth 2.0 is still coming.** Until Convex ships a first-class, native auth system, teams need a production-grade option that does not block them.
2. **Better Auth's plugin model and Convex's component system fight each other.** Better Auth assumes it owns the runtime and tables; Convex wants auth inside a versioned component with generated queries and mutations. Without a bridge, the two leak into each other.
3. **Convex should eventually own auth, but not by throwing Better Auth away.** Better Auth already covers password/email flows, OAuth, 2FA, organizations, API keys, webhooks, and more. The right move is to rebuild those plugin features as Convex-style components, queries, mutations, and actions, then replace pieces with native Convex auth as the platform catches up.

Read the full rationale in [`docs/motivation.md`](docs/motivation.md) and the design details in [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md).

## Packages

| Package                      | npm                          | Path                           | Description                                                                                   |
| ---------------------------- | ---------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `convex-auth`                | `convex-auth`                | `packages/auth`                | Convex auth component, control plane, and server integration. This is what most apps install. |
| `convex-better-auth`         | `convex-better-auth`         | `packages/better-auth`         | Better Auth ↔ Convex bridge (runtime + client).                                               |
| `convex-better-auth-adapter` | `convex-better-auth-adapter` | `packages/better-auth-adapter` | Low-level Better Auth ↔ Convex adapter, vendored and maintained here.                         |
| `convex-auth-react`          | `convex-auth-react`          | `packages/react`               | React UI and hooks.                                                                           |
| `convex-auth-react-native`   | `convex-auth-react-native`   | `packages/react-native`        | Expo / React Native client.                                                                   |
| `convex-auth-core`           | `convex-auth-core`           | `packages/core`                | Auth domain core (permissions, roles, scopes).                                                |
| `convex-auth-ui`             | `convex-auth-ui`             | `packages/ui`                  | Base shadcn-style UI primitives.                                                              |

All packages are independently buildable and published under the Apache-2.0 license.

## Quick start

### Convex component

Use the `convex-auth` component in your `convex/convex.config.ts`:

```ts
import { defineComponents } from "convex/server";
import auth from "convex-auth/component";

export default defineComponents({
  auth,
});
```

For the Convex-native flow, wire up `convex/auth.ts` and `convex/http.ts` as shown in [Convex-native auth (recommended)](#convex-native-auth-recommended). For the Better Auth bridge, see [`docs/better-auth-to-convex.md`](docs/better-auth-to-convex.md).

### React client

Create an auth client with the Convex plugin:

```ts
import { createAuthClient } from "convex-auth-react";
import { convexClient } from "convex-better-auth-adapter/client/plugins";

export const authClient = createAuthClient({
  plugins: [convexClient()],
});
```

Wrap your app in the provider:

```tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "convex-auth-react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function App() {
  return (
    <ConvexProvider client={convex}>
      <BetterAuthConvexProvider client={convex} authClient={authClient}>
        {/** your app */}
      </BetterAuthConvexProvider>
    </ConvexProvider>
  );
}
```

## Convex-native auth (recommended)

`convex-auth` ships a Convex-native auth runtime that stores users, sessions, and identities in your Convex database and runs in the default Convex isolate. It supports email/password, Google/GitHub/Discord OAuth, 2FA, email verification, password reset, sessions, and refresh tokens. No Better Auth server is required.

The native flow is the intended end state of this repository. The Better Auth bridge below is still available for teams that need it while migrating.

### 1. Set environment variables

Generate an RS256 keypair and set it in your Convex deployment:

```bash
convex env set JWT_PRIVATE_KEY '...' # JSON-encoded RSA private key JWK
convex env set JWKS '...'            # JSON Web Key Set containing the public key
```

For email and OAuth, also set:

```bash
convex env set CONVEX_SITE_URL 'https://your-site.convex.site'
convex env set EMAIL_FROM_ADDRESS 'auth@yourdomain.com'
convex env set GITHUB_CLIENT_ID '...'
convex env set GITHUB_CLIENT_SECRET '...'
convex env set GOOGLE_CLIENT_ID '...'
convex env set GOOGLE_CLIENT_SECRET '...'
convex env set DISCORD_CLIENT_ID '...'
convex env set DISCORD_CLIENT_SECRET '...'
```

### 2. Mount the component

```ts
// convex/convex.config.ts
import { defineComponents } from "convex/server";
import auth from "convex-auth/component";

export default defineComponents({
  auth,
});
```

### 3. Configure auth in `convex/auth.ts`

```ts
// convex/auth.ts
import { components } from "./_generated/api";
import { convexAuth, type EmailDraft } from "convex-auth/convex";

const siteUrl = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");

export const auth = convexAuth({
  component: components.convexAuth,
  emailAndPassword: {
    enabled: true,
    email: {
      from: process.env.EMAIL_FROM_ADDRESS ?? "auth@example.com",
      appOrigin: siteUrl,
      sendEmail: async (draft: EmailDraft) => {
        // Send via Resend/Postmark/SES in production.
        // For local dev you can log and return a dummy id.
        console.log("Email draft", draft);
        return "email-id";
      },
      sendOnSignUp: true,
      sendOnSignIn: false,
    },
  },
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
    },
  },
});

export const {
  signUp,
  signIn,
  signOut,
  updateSession,
  sendEmailVerification,
  verifyEmail,
  sendPasswordReset,
  resetPassword,
  verifyPassword,
  twoFactorEnable,
  twoFactorVerifyTOTP,
  twoFactorVerifyBackupCode,
  twoFactorDisable,
  twoFactorGenerateBackupCodes,
} = auth;
```

### 4. Wire HTTP routes in `convex/http.ts`

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

### 5. Wrap the React app

```tsx
// src/main.tsx
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexAuthProvider } from "convex-auth/react";
import { api } from "../convex/_generated/api";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function Root() {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthProvider
        actions={{
          signUp: api.auth.signUp,
          signIn: api.auth.signIn,
          signOut: api.auth.signOut,
        }}
      >
        <App />
      </ConvexAuthProvider>
    </ConvexProvider>
  );
}
```

### 6. Use the actions in components

```tsx
// src/SignIn.tsx
import { useAuthActions } from "convex-auth/react";

export function SignIn() {
  const { signIn, isLoading, isAuthenticated } = useAuthActions();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await signIn({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
  }

  if (isAuthenticated) {
    return <p>Already signed in.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

See `packages/conformance-consumer` for a working deployment with email capture and OAuth stubs, and [`docs/convex-native-auth-strategy.md`](docs/convex-native-auth-strategy.md) for the long-term roadmap.

## Compatibility and migration

- See [`docs/compatibility.md`](docs/compatibility.md) for the current supported versions of Better Auth, Convex, React, React Native / Expo, Node, and pnpm.
- See [`docs/migrating-from-convex-dev-better-auth.md`](docs/migrating-from-convex-dev-better-auth.md) if you are moving from `@convex-dev/better-auth` to `convex-better-auth-adapter`.

## Development

This repo uses pnpm and [Vite+](https://github.com/voidzero-dev/vite_plus) (`vp`) for building, linting, and formatting. Documentation is generated with [Blume](https://useblume.dev) and hosted via [`@convex-dev/static-hosting`](https://github.com/get-convex/static-hosting) from the `site/` workspace.

```bash
pnpm install

pnpm run typecheck   # TypeScript across all packages
pnpm run lint        # Lint
pnpm run build       # Build all packages
pnpm run test        # Run all tests
pnpm run check       # Format + lint check
pnpm run fix         # Auto-fix lint and formatting
```

## CI

A GitHub Actions workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). It runs the full proof (`typecheck`, `check`, `build`, `test`) on Node 20.12+ and Node 22.

## Releasing

Push a `v*` tag or trigger the workflow manually:

```bash
git tag v0.2.0-alpha.0
git push origin v0.2.0-alpha.0
```

The `Release` workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml) builds and publishes every public package to npm. It needs an `NPM_TOKEN` repository secret.

## Attribution

The `convex-better-auth-adapter` package started from the community work in [`get-convex/better-auth`](https://github.com/get-convex/better-auth) and includes the Better Auth 1.7 migration from [`get-convex/better-auth#430`](https://github.com/get-convex/better-auth/pull/430). It is vendored here so the Convex + Better Auth bridge can keep pace with Better Auth releases while Convex Auth 2.0 matures. All original code remains under the Apache-2.0 license.

## License

Apache-2.0 — see `LICENSE`.

<!-- badges -->

[ci-badge]: https://img.shields.io/github/actions/workflow/status/shlomokabareti/convex-better-auth-2.0/ci.yml?branch=main&style=for-the-badge&label=CI
[ci]: https://github.com/shlomokabareti/convex-better-auth-2.0/actions/workflows/ci.yml
[docs-badge]: https://img.shields.io/badge/docs-online-292a44?style=for-the-badge
[docs]: https://gregarious-perch-710.convex.site
[license-badge]: https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=for-the-badge
[license]: LICENSE
[status-badge]: https://img.shields.io/badge/status-alpha-blueviolet.svg?style=for-the-badge
[status]: #status
[node-badge]: https://img.shields.io/badge/node->=20.12.0-brightgreen.svg?style=for-the-badge
[node]: package.json
[pnpm-badge]: https://img.shields.io/badge/pnpm-10.25.0-f69220.svg?style=for-the-badge
[pnpm]: package.json
