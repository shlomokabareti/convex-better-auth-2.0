# convex-better-auth

A **Better Auth → Convex Auth 2.0 migration bridge**.

This package wraps `convex-better-auth-adapter` and exposes a public Better Auth runtime and client on Convex. It is intentionally separate from the native packages (`convex-auth`, `convex-auth-react`, `convex-auth-react-native`) so that existing Better Auth consumers can keep running while they migrate to the Convex-native runtime.

If you are starting a new project, use the native packages directly. If you are migrating from a Better Auth integration, see [`docs/migrating-from-better-auth.md`](../docs/migrating-from-better-auth.md).
