import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Receiver-side storage for the live webhook delivery proof. The turnkey
 * processor POSTs a signed webhook to /api/proofs/webhook-sink, which records
 * the raw body + signature header here so the proof can verify the HMAC and that
 * the delivery row reached `delivered`.
 *
 * Proof-only; not part of the public `convex-auth` consumer surface.
 */
export default defineSchema({
  webhook_proof_sink: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    deliveryHeader: v.optional(v.string()),
    signature: v.optional(v.string()),
    bodyJson: v.string(),
    receivedAt: v.number(),
  }).index("by_event", ["eventId"]),
});
