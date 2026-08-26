export type AccountEmailDeliveryStatus =
  | "not_configured"
  | "queued"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed";

export type ResendAccountEmailEvent =
  | {
      type:
        | "email.sent"
        | "email.delivered"
        | "email.delivery_delayed"
        | "email.complained"
        | "email.opened"
        | "email.clicked";
    }
  | {
      type: "email.bounced";
      data: {
        bounce: {
          message: string;
        };
      };
    }
  | {
      type: "email.failed";
      data: {
        failed: {
          reason: string;
        };
      };
    };

export function mapResendAccountEmailDelivery(args: {
  event: ResendAccountEmailEvent;
}): {
  status: Exclude<AccountEmailDeliveryStatus, "not_configured" | "queued">;
  eventType: ResendAccountEmailEvent["type"];
  error?: string;
} {
  switch (args.event.type) {
    case "email.sent":
      return { status: "sent", eventType: args.event.type };
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
    case "email.complained":
      return { status: "delivered", eventType: args.event.type };
    case "email.delivery_delayed":
      return { status: "delivery_delayed", eventType: args.event.type };
    case "email.bounced":
      return {
        status: "bounced",
        eventType: args.event.type,
        error: args.event.data.bounce.message,
      };
    case "email.failed":
      return {
        status: "failed",
        eventType: args.event.type,
        error: args.event.data.failed.reason,
      };
    default:
      throw new TypeError("Unsupported Resend account email event");
  }
}

export function buildTokenUrl(args: {
  token: string;
  templateUrl?: string | null;
  appOrigin?: string | null;
  path: string;
}): string | null {
  const encodedToken = encodeURIComponent(args.token);
  const templateUrl = args.templateUrl?.trim();

  if (templateUrl && templateUrl.length > 0) {
    if (templateUrl.includes("{token}")) {
      return templateUrl.replaceAll("{token}", encodedToken);
    }
    return appendToken(templateUrl, encodedToken);
  }

  const appOrigin = args.appOrigin?.trim();
  if (!appOrigin || appOrigin.length === 0) {
    return null;
  }

  return `${trimTrailingSlash(appOrigin)}${args.path}?token=${encodedToken}`;
}

export function appendToken(url: string, encodedToken: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodedToken}`;
}

export function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
