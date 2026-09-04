import { processConvexWebhookDelivery, type ConvexWebhookFetch } from "convex-auth/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// The runtime seam: a Convex action's global `fetch` cannot be packaged across
// the runtime boundary, so the consumer supplies it. This is the one line.
const actionFetch: ConvexWebhookFetch = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, text: () => response.text() };
};

const RETRY_RESCHEDULE_DELAY_MS = 15_000;

// RUNAWAY-SAFE: processes a bounded `pending` set; per-delivery atomic claim
// prevents duplicate work; the self-reschedule fires only when a specific
// delivery's status remains "pending". Each iteration moves a delivery toward
// "delivered" or terminal, so the pending set strictly shrinks.
export const processPending = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), delivered: v.number() }),
  handler: async (ctx, { limit }) => {
    const pending = await ctx.runQuery(
      components.convexAuth.webhooks.listPendingWebhookDeliveries,
      { beforeNextAttemptAt: Date.now(), limit },
    );

    const outcomes = await Promise.all(
      pending.map(async (delivery) => {
        const { claimed } = await ctx.runMutation(
          components.convexAuth.webhooks.claimWebhookDelivery,
          { deliveryId: delivery._id },
        );
        if (!claimed) {
          return { delivered: false, retry: false };
        }

        const endpoint = await ctx.runQuery(
          components.convexAuth.webhooks.getWebhookEndpointWithSecret,
          { endpointId: delivery.endpointId },
        );
        const { update } = await processConvexWebhookDelivery({
          endpoint:
            endpoint === null
              ? null
              : {
                  _id: endpoint._id,
                  url: endpoint.url,
                  secret: endpoint.secret,
                  status: endpoint.status,
                },
          delivery,
          fetch: actionFetch,
        });
        await ctx.runMutation(components.convexAuth.webhooks.updateWebhookDelivery, {
          deliveryId: delivery._id,
          ...update,
        });
        return {
          delivered: update.status === "delivered",
          retry: update.status === "pending",
        };
      }),
    );

    if (outcomes.some((outcome) => outcome.retry)) {
      await ctx.scheduler.runAfter(
        RETRY_RESCHEDULE_DELAY_MS,
        internal.webhookDeliveries.processPending,
        {},
      );
    }
    const delivered = outcomes.filter((outcome) => outcome.delivered).length;

    return { processed: pending.length, delivered };
  },
});
