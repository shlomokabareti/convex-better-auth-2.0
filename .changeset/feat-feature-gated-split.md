---
"convex-auth": minor
---

Add feature-gated, self-contained auth component registration. Consumers can now mount `convexAuthCore`, `convexAuthOrganizations`, `convexAuthApiKeys`, and the add-on components (`servicePrincipals`, `agentAuth`, `authMd`, `webhooks`, `mcpOauth`) independently instead of the full monolithic component. The legacy `convexAuth` full component remains available for backward compatibility, and `convexAuth()` plus `createConvexAuthOrganizationOperations` now accept a split `components` bag.
