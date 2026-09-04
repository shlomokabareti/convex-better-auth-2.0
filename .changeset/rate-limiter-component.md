---
"convex-auth": minor
---

Use `@convex-dev/rate-limiter` for native sign-in rate limiting.

`convexAuth`, `convexAuthCore`, and `convexAuthOrganizations` now mount the `@convex-dev/rate-limiter` component internally. Sign-in rate-limit checks are handled by the external component instead of the custom `authRateLimits` table, which has been removed.
