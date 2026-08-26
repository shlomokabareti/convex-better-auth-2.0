Convex authorization modules.

Current:

- declarative authorize helpers for authenticated / session / organization / restriction / permission checks
- typed `AuthorizationFailureCode` on authorization decisions
- throw-based require helpers built on top of shared authorization decisions
- restriction-aware permission enforcement so paused principals fail before permission checks

Consumer contract:

- `authorizePermission(...)` expects the consumer principal to already carry effective concrete permissions
- wildcard semantics like `*` or `organization:*` must be expanded before calling package permission checks
- package currently does exact permission membership checks, not wildcard parsing at authorization time

Still needed for full runtime:

- policy bundles for common resource patterns
- broader consumer adoption outside current Convex reference paths
- optional shared wildcard/expanded-permission normalization if more consumers need it
