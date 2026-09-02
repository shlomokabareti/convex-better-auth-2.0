/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    servicePrincipals: {
      getServicePrincipal: FunctionReference<
        "query",
        "internal",
        { servicePrincipalId: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          key: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          permissions: Array<string>;
          status: "active" | "disabled";
          updatedAt: number;
        },
        Name
      >;
      getServicePrincipalByKey: FunctionReference<
        "query",
        "internal",
        { key: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          key: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          permissions: Array<string>;
          status: "active" | "disabled";
          updatedAt: number;
        },
        Name
      >;
      listServicePrincipals: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          organizationId?: string;
          status?: "active" | "disabled";
        },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          key: string;
          metadataJson?: string;
          name: string;
          organizationId?: string;
          permissions: Array<string>;
          status: "active" | "disabled";
          updatedAt: number;
        }>,
        Name
      >;
      setServicePrincipalDetails: FunctionReference<
        "mutation",
        "internal",
        {
          actingOrganizationId: string;
          description?: string | null;
          metadataJson?: string | null;
          name?: string;
          organizationId?: string | null;
          permissions?: Array<string>;
          servicePrincipalId: string;
        },
        { ok: true },
        Name
      >;
      setServicePrincipalStatus: FunctionReference<
        "mutation",
        "internal",
        {
          actingOrganizationId: string;
          servicePrincipalId: string;
          status: "active" | "disabled";
        },
        { ok: true },
        Name
      >;
      upsertServicePrincipal: FunctionReference<
        "mutation",
        "internal",
        {
          createdBy?: string;
          description?: string | null;
          key: string;
          metadataJson?: string | null;
          name: string;
          organizationId?: string | null;
          permissions: Array<string>;
          servicePrincipalId?: string;
          status?: "active" | "disabled";
        },
        { created: boolean; servicePrincipalId: string },
        Name
      >;
    };
  };
