import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();
auth.addHttpRoutes(http);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readRequestJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a JSON object body");
  }
  return Object.fromEntries(Object.entries(value));
}

const PROOF_ENDPOINT_MARKER = "live-delivery-proof";
const PROOF_ORGANIZATION_SLUG = "convex-auth-webhook-proof-org";
const PROOF_SINK_MAX_BODY_BYTES = 16 * 1024;

async function ensureProofOrganizationId(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
): Promise<string> {
  const existing = await ctx.runQuery(components.convexAuth.organizations.getOrganizationBySlug, {
    slug: PROOF_ORGANIZATION_SLUG,
  });
  if (existing !== null) {
    return existing._id;
  }
  const { organizationId } = await ctx.runMutation(
    components.convexAuth.organizations.upsertOrganization,
    { name: "Convex Auth Webhook Proof", slug: PROOF_ORGANIZATION_SLUG },
  );
  return organizationId;
}

function proofsDisabled(): Response | null {
  if (process.env.ENABLE_WEBHOOK_PROOFS === "true") {
    return null;
  }
  return json(404, { ok: false, message: "No matching routes found" });
}

{
  http.route({
    path: "/api/proofs/webhook-sink",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      const bodyJson = await request.text();
      if (bodyJson.length > PROOF_SINK_MAX_BODY_BYTES) {
        return json(413, { ok: false, message: "payload too large" });
      }
      let eventType = request.headers.get("x-convex-event") ?? "";
      let eventId = request.headers.get("x-convex-delivery") ?? "";
      if (eventId === "") {
        try {
          const parsed: unknown = JSON.parse(bodyJson);
          const id =
            typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "id") : undefined;
          const type =
            typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "type") : undefined;
          eventId = typeof id === "string" ? id : "";
          if (eventType === "" && typeof type === "string") {
            eventType = type;
          }
        } catch {
          // leave eventId empty; the proof asserts on what it can verify
        }
      }
      await ctx.runMutation(internal.webhookProofSink.recordReceivedWebhook, {
        eventId,
        eventType,
        deliveryHeader: request.headers.get("x-convex-delivery") ?? undefined,
        signature: request.headers.get("x-convex-signature") ?? undefined,
        bodyJson,
      });
      return json(200, { ok: true });
    }),
  });

  http.route({
    path: "/api/proofs/fire-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      try {
        const body = await readRequestJsonObject(request);
        if (
          typeof body.eventType !== "string" ||
          typeof body.payloadJson !== "string" ||
          typeof body.secret !== "string"
        ) {
          return json(400, {
            ok: false,
            message: "eventType, payloadJson, and secret are required",
          });
        }

        const proofOrganizationId = await ensureProofOrganizationId(ctx);
        const sinkUrl = new URL("/api/proofs/webhook-sink", request.url).toString();
        const { endpointId } = await ctx.runMutation(
          components.convexAuth.webhooks.createWebhookEndpoint,
          {
            organizationId: proofOrganizationId,
            url: sinkUrl,
            eventTypes:
              Array.isArray(body.eventTypes) &&
              body.eventTypes.every((value) => typeof value === "string")
                ? body.eventTypes
                : [body.eventType],
            secret: body.secret,
            description: PROOF_ENDPOINT_MARKER,
          },
        );

        const eventId = crypto.randomUUID();
        const { deliveryIds } = await ctx.runMutation(
          components.convexAuth.webhooks.enqueueWebhookEvent,
          {
            eventType: body.eventType,
            eventId,
            payloadJson: body.payloadJson,
            organizationId: proofOrganizationId,
          },
        );

        await ctx.scheduler.runAfter(0, internal.webhookDeliveries.processPending, {});

        return json(200, { ok: true, endpointId, eventId, deliveryIds });
      } catch (error) {
        return json(500, {
          ok: false,
          message: error instanceof Error ? error.message : "fire-webhook failed",
        });
      }
    }),
  });

  http.route({
    path: "/api/proofs/webhook-sink",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      const eventId = new URL(request.url).searchParams.get("eventId") ?? "";
      const received = await ctx.runQuery(internal.webhookProofSink.getReceivedWebhooks, {
        eventId,
      });
      return json(200, { ok: true, received });
    }),
  });

  http.route({
    path: "/api/proofs/webhook-delivery",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      const deliveryId = new URL(request.url).searchParams.get("deliveryId");
      if (!deliveryId) {
        return json(400, { ok: false, message: "deliveryId is required" });
      }
      const delivery = await ctx.runQuery(components.convexAuth.webhooks.getWebhookDelivery, {
        deliveryId,
      });
      return json(200, { ok: true, delivery });
    }),
  });

  http.route({
    path: "/api/proofs/webhook-reset",
    method: "POST",
    handler: httpAction(async (ctx) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      const proofOrganizationId = await ensureProofOrganizationId(ctx);
      const endpoints = await ctx.runQuery(
        components.convexAuth.webhooks.listWebhookEndpointsByOrganization,
        { organizationId: proofOrganizationId },
      );
      const proofEndpoints = endpoints.filter(
        (endpoint) => endpoint.description === PROOF_ENDPOINT_MARKER,
      );
      await Promise.all(
        proofEndpoints.map(async (endpoint) => {
          await ctx.runMutation(components.convexAuth.webhooks.setWebhookEndpointStatus, {
            endpointId: endpoint._id,
            organizationId: proofOrganizationId,
            status: "archived",
          });
          await ctx.runMutation(components.convexAuth.webhooks.deleteWebhookEndpoint, {
            endpointId: endpoint._id,
            organizationId: proofOrganizationId,
          });
        }),
      );

      const stale = await ctx.runQuery(
        components.convexAuth.webhooks.listPendingWebhookDeliveries,
        { limit: 1000, beforeNextAttemptAt: Date.now() },
      );
      const exhaustedAt = Date.now();
      await Promise.all(
        stale.map((delivery) =>
          ctx.runMutation(components.convexAuth.webhooks.updateWebhookDelivery, {
            deliveryId: delivery._id,
            status: "failed",
            exhaustedAt,
          }),
        ),
      );

      return json(200, {
        ok: true,
        deleted: proofEndpoints.length,
        drained: stale.length,
      });
    }),
  });

  http.route({
    path: "/api/proofs/webhook-cleanup",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const disabled = proofsDisabled();
      if (disabled) return disabled;

      const body = await readRequestJsonObject(request);
      if (typeof body.endpointId === "string") {
        const endpoint = await ctx.runQuery(components.convexAuth.webhooks.getWebhookEndpoint, {
          endpointId: body.endpointId,
        });
        if (endpoint === null || endpoint.description !== PROOF_ENDPOINT_MARKER) {
          return json(403, { ok: false, message: "not a proof-created endpoint" });
        }
        const proofOrganizationId = await ensureProofOrganizationId(ctx);
        await ctx.runMutation(components.convexAuth.webhooks.setWebhookEndpointStatus, {
          endpointId: body.endpointId,
          organizationId: proofOrganizationId,
          status: "archived",
        });
        await ctx.runMutation(components.convexAuth.webhooks.deleteWebhookEndpoint, {
          endpointId: body.endpointId,
          organizationId: proofOrganizationId,
        });
      }
      if (typeof body.eventId === "string") {
        await ctx.runMutation(internal.webhookProofSink.clearReceivedWebhooks, {
          eventId: body.eventId,
        });
      }
      return json(200, { ok: true });
    }),
  });
}

export default http;
