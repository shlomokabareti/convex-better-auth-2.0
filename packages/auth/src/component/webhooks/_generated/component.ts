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
    webhooks: {
      claimWebhookDelivery: FunctionReference<
        "mutation",
        "internal",
        { deliveryId: string },
        { claimed: boolean },
        Name
      >;
      createWebhookDelivery: FunctionReference<
        "mutation",
        "internal",
        {
          createdAt?: number;
          endpointId: string;
          eventId: string;
          eventType: string;
          metadataJson?: string;
          payloadJson: string;
        },
        { created: true; deliveryId: string },
        Name
      >;
      createWebhookEndpoint: FunctionReference<
        "mutation",
        "internal",
        {
          createdAt?: number;
          createdBy?: string;
          description?: string;
          eventTypes: Array<string>;
          metadataJson?: string;
          organizationId?: string;
          secret: string;
          url: string;
        },
        { created: boolean; endpointId: string },
        Name
      >;
      deleteWebhookEndpoint: FunctionReference<
        "mutation",
        "internal",
        { endpointId: string; organizationId: string },
        { ok: true },
        Name
      >;
      enqueueWebhookEvent: FunctionReference<
        "mutation",
        "internal",
        {
          createdAt?: number;
          eventId: string;
          eventType: string;
          metadataJson?: string;
          organizationId?: string;
          payloadJson: string;
        },
        { deliveryIds: Array<string>; enqueued: number; eventId: string },
        Name
      >;
      getWebhookDelivery: FunctionReference<
        "query",
        "internal",
        { deliveryId: string },
        null | {
          _creationTime: number;
          _id: string;
          attemptCount: number;
          createdAt: number;
          deliveredAt?: number;
          endpointId: string;
          eventId: string;
          eventType: string;
          exhaustedAt?: number;
          failureKind?:
            | "endpoint_inactive"
            | "network_error"
            | "rate_limited"
            | "server_error"
            | "client_error"
            | "unknown_error";
          metadataJson?: string;
          nextAttemptAt?: number;
          payloadJson: string;
          responseBody?: string;
          responseStatus?: number;
          status: "pending" | "processing" | "delivered" | "failed";
          updatedAt: number;
        },
        Name
      >;
      getWebhookEndpoint: FunctionReference<
        "query",
        "internal",
        { endpointId: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          eventTypes: Array<string>;
          metadataJson?: string;
          organizationId?: string;
          status: "active" | "disabled" | "archived";
          updatedAt: number;
          url: string;
        },
        Name
      >;
      getWebhookEndpointWithSecret: FunctionReference<
        "query",
        "internal",
        { endpointId: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          eventTypes: Array<string>;
          metadataJson?: string;
          organizationId?: string;
          secret: string;
          status: "active" | "disabled" | "archived";
          updatedAt: number;
          url: string;
        },
        Name
      >;
      listPendingWebhookDeliveries: FunctionReference<
        "query",
        "internal",
        { beforeNextAttemptAt?: number; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          attemptCount: number;
          createdAt: number;
          deliveredAt?: number;
          endpointId: string;
          eventId: string;
          eventType: string;
          exhaustedAt?: number;
          failureKind?:
            | "endpoint_inactive"
            | "network_error"
            | "rate_limited"
            | "server_error"
            | "client_error"
            | "unknown_error";
          metadataJson?: string;
          nextAttemptAt?: number;
          payloadJson: string;
          responseBody?: string;
          responseStatus?: number;
          status: "pending" | "processing" | "delivered" | "failed";
          updatedAt: number;
        }>,
        Name
      >;
      listWebhookDeliveriesByEndpoint: FunctionReference<
        "query",
        "internal",
        {
          endpointId: string;
          limit?: number;
          status?: "pending" | "processing" | "delivered" | "failed";
        },
        Array<{
          _creationTime: number;
          _id: string;
          attemptCount: number;
          createdAt: number;
          deliveredAt?: number;
          endpointId: string;
          eventId: string;
          eventType: string;
          exhaustedAt?: number;
          failureKind?:
            | "endpoint_inactive"
            | "network_error"
            | "rate_limited"
            | "server_error"
            | "client_error"
            | "unknown_error";
          metadataJson?: string;
          nextAttemptAt?: number;
          payloadJson: string;
          responseBody?: string;
          responseStatus?: number;
          status: "pending" | "processing" | "delivered" | "failed";
          updatedAt: number;
        }>,
        Name
      >;
      listWebhookEndpointsByOrganization: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          organizationId: string;
          status?: "active" | "disabled" | "archived";
        },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          createdBy?: string;
          description?: string;
          eventTypes: Array<string>;
          metadataJson?: string;
          organizationId?: string;
          status: "active" | "disabled" | "archived";
          updatedAt: number;
          url: string;
        }>,
        Name
      >;
      rotateWebhookEndpointSecret: FunctionReference<
        "mutation",
        "internal",
        {
          endpointId: string;
          organizationId: string;
          secret: string;
          updatedAt?: number;
        },
        { ok: true },
        Name
      >;
      setWebhookEndpointStatus: FunctionReference<
        "mutation",
        "internal",
        {
          endpointId: string;
          organizationId: string;
          status: "active" | "disabled" | "archived";
          updatedAt?: number;
        },
        { ok: true },
        Name
      >;
      updateWebhookDelivery: FunctionReference<
        "mutation",
        "internal",
        {
          attemptCount?: number;
          deliveredAt?: number | null;
          deliveryId: string;
          exhaustedAt?: number | null;
          failureKind?:
            | "endpoint_inactive"
            | "network_error"
            | "rate_limited"
            | "server_error"
            | "client_error"
            | "unknown_error"
            | null;
          metadataJson?: string | null;
          nextAttemptAt?: number | null;
          responseBody?: string | null;
          responseStatus?: number | null;
          status?: "pending" | "processing" | "delivered" | "failed";
          updatedAt?: number;
        },
        { ok: true },
        Name
      >;
      updateWebhookEndpoint: FunctionReference<
        "mutation",
        "internal",
        {
          description?: string;
          endpointId: string;
          eventTypes?: Array<string>;
          metadataJson?: string;
          organizationId: string;
          url?: string;
        },
        { ok: true },
        Name
      >;
    };
  };
