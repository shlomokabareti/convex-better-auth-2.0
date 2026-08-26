import {
  Button,
  EmailLayout,
  EmailText,
  renderEmail,
  renderEmailText,
} from "../../lib/email";

import {
  buildTokenUrl,
  mapResendAccountEmailDelivery,
  type AccountEmailDeliveryStatus,
  type ResendAccountEmailEvent,
} from "./emailShared";

export type EmailVerificationEmailDeliveryStatus = AccountEmailDeliveryStatus;

export type EmailVerificationEmailDeliveryResult =
  | {
      status: "not_configured";
      reason: "missing_from_address" | "missing_verify_url";
    }
  | {
      status: "queued";
      emailId: string;
    }
  | {
      status: "failed";
      reason: string;
    };

export type EmailVerificationEmailNotConfiguredReason = Extract<
  EmailVerificationEmailDeliveryResult,
  { status: "not_configured" }
>["reason"];

export type EmailVerificationEmailDraft = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailVerificationEmailContext = {
  email: string;
  expiresAt?: number;
};

export type EmailVerificationEmailDeliveryPatch = {
  emailId?: string;
  emailDeliveryStatus: EmailVerificationEmailDeliveryStatus;
  emailDeliveryEvent: string;
  emailDeliveryError?: string;
  emailDeliveryUpdatedAt: number;
};

export type ResendVerificationEmailEvent = ResendAccountEmailEvent;

export function buildEmailVerificationUrl(args: {
  token: string;
  templateUrl?: string | null;
  appOrigin?: string | null;
  verifyPath?: string;
}): string | null {
  return buildTokenUrl({
    token: args.token,
    templateUrl: args.templateUrl,
    appOrigin: args.appOrigin,
    path: args.verifyPath ?? "/verify-email",
  });
}

export async function createEmailVerificationEmailDraft(args: {
  from?: string | null;
  to: string;
  verifyUrl: string | null;
  expiresAt?: number;
}): Promise<
  | EmailVerificationEmailDraft
  | Extract<EmailVerificationEmailDeliveryResult, { status: "not_configured" }>
> {
  const from = args.from?.trim();
  if (!from || from.length === 0) {
    return { status: "not_configured", reason: "missing_from_address" };
  }
  if (args.verifyUrl === null) {
    return { status: "not_configured", reason: "missing_verify_url" };
  }

  const template = (
    <EmailVerificationEmailTemplate
      verifyUrl={args.verifyUrl}
      expiresAt={args.expiresAt}
    />
  );
  const textTemplate = (
    <EmailVerificationEmailTemplate
      verifyUrl={args.verifyUrl}
      expiresAt={args.expiresAt}
      plainText
    />
  );
  const [html, text] = await Promise.all([
    renderEmail(template),
    renderEmailText(textTemplate),
  ]);

  return {
    from,
    to: args.to,
    subject: "Verify your email",
    html,
    text,
  };
}

export function resolveEmailVerificationFromAddress(args: {
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

export function createEmailVerificationEmailQueuedPatch(args: {
  emailId: string;
  now?: number;
}): EmailVerificationEmailDeliveryPatch {
  return {
    emailId: args.emailId,
    emailDeliveryStatus: "queued",
    emailDeliveryEvent: "queued",
    emailDeliveryError: undefined,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createEmailVerificationEmailNotConfiguredPatch(args: {
  reason: EmailVerificationEmailNotConfiguredReason;
  now?: number;
}): EmailVerificationEmailDeliveryPatch {
  return {
    emailDeliveryStatus: "not_configured",
    emailDeliveryEvent: args.reason,
    emailDeliveryError: undefined,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createEmailVerificationEmailFailedPatch(args: {
  reason: string;
  now?: number;
}): EmailVerificationEmailDeliveryPatch {
  return {
    emailDeliveryStatus: "failed",
    emailDeliveryEvent: "enqueue_failed",
    emailDeliveryError: args.reason,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export function createEmailVerificationEmailEventPatch(args: {
  event: ResendVerificationEmailEvent;
  now?: number;
}): EmailVerificationEmailDeliveryPatch {
  const delivery = mapResendEventToVerificationEmailDelivery({
    event: args.event,
  });
  return {
    emailDeliveryStatus: delivery.status,
    emailDeliveryEvent: delivery.eventType,
    emailDeliveryError: delivery.error,
    emailDeliveryUpdatedAt: args.now ?? Date.now(),
  };
}

export async function sendEmailVerificationEmail(args: {
  token: string;
  account: EmailVerificationEmailContext | null;
  from?: string | null;
  templateUrl?: string | null;
  appOrigin?: string | null;
  verifyPath?: string;
  sendEmail: (draft: EmailVerificationEmailDraft) => Promise<string>;
  recordQueued: (
    emailId: string
  ) => Promise<EmailVerificationEmailDeliveryResult>;
  recordNotConfigured: (
    reason: EmailVerificationEmailNotConfiguredReason
  ) => Promise<EmailVerificationEmailDeliveryResult>;
  recordFailed: (
    reason: string
  ) => Promise<EmailVerificationEmailDeliveryResult>;
  renderEmailDraft?: (args: {
    from: string;
    to: string;
    verifyUrl: string;
    expiresAt?: number;
  }) => Promise<EmailVerificationEmailDraft>;
}): Promise<EmailVerificationEmailDeliveryResult> {
  if (args.account === null) {
    return await args.recordFailed("Account not found");
  }

  const verifyUrl = buildEmailVerificationUrl({
    token: args.token,
    templateUrl: args.templateUrl,
    appOrigin: args.appOrigin,
    verifyPath: args.verifyPath,
  });

  const transportDraft = await createEmailVerificationEmailDraft({
    from: args.from,
    to: args.account.email,
    verifyUrl,
    expiresAt: args.account.expiresAt,
  });

  if ("status" in transportDraft) {
    return await args.recordNotConfigured(transportDraft.reason);
  }

  if (verifyUrl === null) {
    return await args.recordNotConfigured("missing_verify_url");
  }

  try {
    const emailDraft =
      args.renderEmailDraft === undefined
        ? transportDraft
        : await args.renderEmailDraft({
            from: transportDraft.from,
            to: transportDraft.to,
            verifyUrl,
            expiresAt: args.account.expiresAt,
          });
    const emailId = await args.sendEmail(emailDraft);
    return await args.recordQueued(emailId);
  } catch (error) {
    return await args.recordFailed(
      error instanceof Error ? error.message : "Unknown email delivery error"
    );
  }
}

export function mapResendEventToVerificationEmailDelivery(args: {
  event: ResendVerificationEmailEvent;
}): {
  status: Exclude<
    EmailVerificationEmailDeliveryStatus,
    "not_configured" | "queued"
  >;
  eventType: ResendVerificationEmailEvent["type"];
  error?: string;
} {
  return mapResendAccountEmailDelivery({ event: args.event });
}

function EmailVerificationEmailTemplate(args: {
  verifyUrl: string;
  expiresAt?: number;
  plainText?: boolean;
}) {
  return (
    <EmailLayout preview="Verify your email">
      <EmailText>
        Confirm your email address to finish setting up your account.
      </EmailText>
      {args.plainText === true ? (
        <EmailText>Verify your email: {args.verifyUrl}</EmailText>
      ) : (
        <Button href={args.verifyUrl}>Verify your email</Button>
      )}
      {args.expiresAt === undefined ? null : (
        <EmailText>
          This link expires {new Date(args.expiresAt).toUTCString()}.
        </EmailText>
      )}
    </EmailLayout>
  );
}
