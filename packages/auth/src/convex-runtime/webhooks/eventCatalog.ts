/**
 * Canonical Convex auth-domain webhook event catalog.
 *
 * These are the auth-domain events the package owns and fires on behalf of
 * consumers: user lifecycle, organization lifecycle, membership, and
 * invitation events. Business-domain event names (e.g. `person.created`,
 * `opportunity.updated`) remain consumer-local per the delivery-queue recipe;
 * this catalog only covers events convex-auth itself emits.
 */
export const VORTEX_WEBHOOK_EVENT_TYPES = [
  "user.created",
  "user.updated",
  "user.deleted",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "member.added",
  "member.removed",
  "member.role_changed",
  "invitation.created",
  "invitation.accepted",
  "invitation.revoked",
] as const;

export type ConvexWebhookEventType =
  (typeof VORTEX_WEBHOOK_EVENT_TYPES)[number];

const convexWebhookEventTypeSet: ReadonlySet<string> = new Set(
  VORTEX_WEBHOOK_EVENT_TYPES
);

/**
 * Type guard for the canonical Convex auth-domain event catalog. Returns false
 * for consumer-local business events and for the `*` subscribe-all wildcard.
 */
export function isConvexWebhookEventType(
  value: string
): value is ConvexWebhookEventType {
  return convexWebhookEventTypeSet.has(value);
}

export const VORTEX_WEBHOOK_SUBSCRIBE_ALL = "*" as const;

/**
 * Decide whether an endpoint subscribed to `subscribedEventTypes` should
 * receive `eventType`. An endpoint matches when it explicitly subscribes to the
 * event type or subscribes to the `*` wildcard. An empty subscription list
 * matches nothing (the consumer must opt in).
 */
export function convexWebhookEndpointSubscribesTo(
  subscribedEventTypes: readonly string[],
  eventType: string
): boolean {
  for (const subscribed of subscribedEventTypes) {
    if (
      subscribed === VORTEX_WEBHOOK_SUBSCRIBE_ALL ||
      subscribed === eventType
    ) {
      return true;
    }
  }
  return false;
}
