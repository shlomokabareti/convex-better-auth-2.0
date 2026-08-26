import { renderOrganizationInvitationEmailDraft } from "./invitationEmailTemplate";

export type InvitationEmailDeliveryStatus =
  | "not_configured"
  | "queued"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed";

export type InvitationEmailDeliveryResult =
  | {
      status: "not_configured";
      reason: "missing_from_address" | "missing_accept_url";
    }
  | {
      status: "queued";
      emailId: string;
    }
  | {
      status: "failed";
      reason: string;
    };

export type InvitationEmailNotConfiguredReason = Extract<
  InvitationEmailDeliveryResult,
  { status: "not_configured" }
>["reason"];

export type OrganizationInvitationEmailDraft = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type OrganizationInvitationEmailContext = {
  email: string;
  organizationName: string;
  roleName: string;
  inviterLabel: string;
  expiresAt: number;
};

export type InvitationEmailDeliveryPatch = {
  emailId?: string;
  emailDeliveryStatus: InvitationEmailDeliveryStatus;
  emailDeliveryEvent: string;
  emailDeliveryError?: string;
  emailDeliveryUpdatedAt: number;
};

export type ResendInvitationEmailEvent =
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

export function buildInvitationAcceptUrl(args: {
  token: string;
  templateUrl?: string | null;
  appOrigin?: string | null;
  invitePath?: string;
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

  return `${trimTrailingSlash(appOrigin)}${args.invitePath ?? "/accept-invite"}?token=${encodedToken}`;
}

export async function createOrganizationInvitationEmailDraft(args: {
  from?: string | null;
  to: string;
  acceptUrl: string | null;
  organizationName: string;
  roleName: string;
  inviterLabel: string;
  expiresAt: number;
}): Promise<
  | OrganizationInvitationEmailDraft
  | Extract<InvitationEmailDeliveryResult, { status: "not_configured" }>
> {
  const from = args.from?.trim();
  if (!from || from.length === 0) {
    return { status: "not_configured", reason: "missing_from_address" };
  }
  if (args.acceptUrl === null) {
    return { status: "not_configured", reason: "missing_accept_url" };
  }

  return await renderOrganizationInvitationEmailDraft({
    ...args,
    from,
    acceptUrl: args.acceptUrl,
  });
}

export function resolveInvitationEmailFromAddress(args: {
  primary?: string | null;
  fallback?: string | null;
}): string | null {
  for (const value of [args.primary, args.fallback]) {
    const normalized = value?.trim();
    if (normalized && normalized.length > 0) {
      return normalized;
    }
  }
  return null;
}

export function createInvitationEmailQueuedPatch(args: {
  emailId: string;
  now?: number;
}): InvitationEmailDeliveryPatch {
  return {
    emailId: args.emailId,
    emailDeliveryStatus: "queued",
    emailDeliveryEvent: "queued",
    emailDeliveryError: undefined,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createInvitationEmailNotConfiguredPatch(args: {
  reason: InvitationEmailNotConfiguredReason;
  now?: number;
}): InvitationEmailDeliveryPatch {
  return {
    emailDeliveryStatus: "not_configured",
    emailDeliveryEvent: args.reason,
    emailDeliveryError: undefined,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createInvitationEmailFailedPatch(args: {
  reason: string;
  now?: number;
}): InvitationEmailDeliveryPatch {
  return {
    emailDeliveryStatus: "failed",
    emailDeliveryEvent: "enqueue_failed",
    emailDeliveryError: args.reason,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createInvitationEmailEventPatch(args: {
  event: ResendInvitationEmailEvent;
  now?: number;
}): InvitationEmailDeliveryPatch {
  const delivery = mapResendEventToInvitationEmailDelivery({
    event: args.event,
  });
  return {
    emailDeliveryStatus: delivery.status,
    emailDeliveryEvent: delivery.eventType,
    emailDeliveryError: delivery.error,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export async function sendOrganizationInvitationEmail(args: {
  token: string;
  invitation: OrganizationInvitationEmailContext | null;
  from?: string | null;
  templateUrl?: string | null;
  appOrigin?: string | null;
  invitePath?: string;
  sendEmail: (draft: OrganizationInvitationEmailDraft) => Promise<string>;
  recordQueued: (emailId: string) => Promise<InvitationEmailDeliveryResult>;
  recordNotConfigured: (
    reason: InvitationEmailNotConfiguredReason,
  ) => Promise<InvitationEmailDeliveryResult>;
  recordFailed: (reason: string) => Promise<InvitationEmailDeliveryResult>;
  renderEmailDraft?: (args: {
    from: string;
    to: string;
    acceptUrl: string;
    organizationName: string;
    roleName: string;
    inviterLabel: string;
    expiresAt: number;
  }) => Promise<OrganizationInvitationEmailDraft>;
}): Promise<InvitationEmailDeliveryResult> {
  if (args.invitation === null) {
    return await args.recordFailed("Invitation not found");
  }

  const acceptUrl = buildInvitationAcceptUrl({
    token: args.token,
    templateUrl: args.templateUrl,
    appOrigin: args.appOrigin,
    invitePath: args.invitePath,
  });

  const transportDraft = await createOrganizationInvitationEmailDraft({
    from: args.from,
    to: args.invitation.email,
    acceptUrl,
    organizationName: args.invitation.organizationName,
    roleName: args.invitation.roleName,
    inviterLabel: args.invitation.inviterLabel,
    expiresAt: args.invitation.expiresAt,
  });

  if ("status" in transportDraft) {
    return await args.recordNotConfigured(transportDraft.reason);
  }

  if (acceptUrl === null) {
    return await args.recordNotConfigured("missing_accept_url");
  }

  try {
    const emailDraft =
      args.renderEmailDraft === undefined
        ? transportDraft
        : await args.renderEmailDraft({
            from: transportDraft.from,
            to: transportDraft.to,
            acceptUrl,
            organizationName: args.invitation.organizationName,
            roleName: args.invitation.roleName,
            inviterLabel: args.invitation.inviterLabel,
            expiresAt: args.invitation.expiresAt,
          });
    const emailId = await args.sendEmail(emailDraft);
    return await args.recordQueued(emailId);
  } catch (error) {
    return await args.recordFailed(
      error instanceof Error ? error.message : "Unknown email delivery error",
    );
  }
}

export function mapResendEventToInvitationEmailDelivery(args: {
  event: ResendInvitationEmailEvent;
}): {
  status: Exclude<InvitationEmailDeliveryStatus, "not_configured" | "queued">;
  eventType: ResendInvitationEmailEvent["type"];
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
      throw new TypeError("Unsupported Resend invitation email event");
  }
}

function appendToken(url: string, encodedToken: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodedToken}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
