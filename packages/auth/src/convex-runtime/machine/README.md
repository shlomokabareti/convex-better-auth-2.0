Convex machine-auth modules.

Current:

- API key record status resolution, including absolute expiry and optional idle timeout
- service principal status resolution
- explicit active-record guards for API keys and service principals
- owner upper-bound permission intersection

API-key idle timeout is app opt-in. Store `createdAt`, `lastUsedAt`, and `maxIdleMs`
on the app-owned API key row, call the package active-record guard before resolving
the principal, then update `lastUsedAt` only after the request has passed all
application authorization checks.

Still needed for full runtime:

- actual store lookup / fetch adapters
- end-to-end machine credential resolution in a real app runtime
