import type { OrganizationRoleTemplate } from "./invitationPolicy";

/**
 * A single default organization role definition.
 *
 * Permission keys are free-form, consumer-owned strings following the
 * `domain:subdomain:action` convention already used across the component
 * (e.g. `organization:read`, `organization:members:update`). `"*"` grants
 * everything, and a `domain:*` form (interpreted by the consumer's permission
 * checker) grants everything within a domain.
 *
 * convex-auth does NOT ship a canonical permission registry — products extend
 * this vocabulary per their own feature set. The keys below are a sensible,
 * documented baseline that consumers can override by passing their own catalog.
 */
export type OrganizationRoleDefinition = {
  key: OrganizationRoleTemplate;
  name: string;
  description: string;
  /** Permission keys; `"*"` = all. Free-form `domain:action` strings. */
  permissions: string[];
  isSystem: boolean;
};

/**
 * The default organization role catalog seeded for a new organization.
 *
 * Returns a fresh array (and fresh permission arrays) on every call so callers
 * can safely mutate the result without affecting future calls.
 *
 * Tiers (least → most restrictive):
 * - `owner`  — full control (`*`); system role.
 * - `admin`  — broad management EXCLUDING billing and org deletion; system role.
 * - `manager`— operational management of members and invitations.
 * - `member` — baseline authenticated access.
 * - `viewer` — read-only.
 */
export function defaultOrganizationRoleCatalog(): OrganizationRoleDefinition[] {
  return [
    {
      key: "owner",
      name: "Owner",
      description:
        "Full control over the organization, including billing and deletion.",
      permissions: ["*"],
      isSystem: true,
    },
    {
      key: "admin",
      name: "Admin",
      description:
        "Manage members, roles, and invitations. Cannot manage billing or delete the organization.",
      permissions: [
        "organization:read",
        "organization:update",
        "organization:members:read",
        "organization:members:manage",
        "organization:roles:read",
        "organization:roles:manage",
        "organization:invitations:read",
        "organization:invitations:manage",
      ],
      isSystem: true,
    },
    {
      key: "manager",
      name: "Manager",
      description: "Operational management of members and invitations.",
      permissions: [
        "organization:read",
        "organization:members:read",
        "organization:members:manage",
        "organization:invitations:read",
        "organization:invitations:manage",
      ],
      isSystem: false,
    },
    {
      key: "member",
      name: "Member",
      description: "Baseline access for an organization member.",
      permissions: ["organization:read", "organization:members:read"],
      isSystem: false,
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only access to the organization.",
      permissions: ["organization:read", "organization:members:read"],
      isSystem: false,
    },
  ];
}
