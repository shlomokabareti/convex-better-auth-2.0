import type { EmailDraft, EmailSender } from "../native/provider.js";
import type { EmailOtpSender } from "../native/emailOtp.js";

export type ResendEmailSenderOptions = {
  /** Resend API key. Keep this in Convex environment variables, not source. */
  apiKey: string;
  /** Default sender address used when a draft does not specify `from`. */
  from?: string;
  /** Optional `fetch` implementation for testing or custom runtimes. */
  fetch?: typeof fetch;
};

export type ResendEmailSendResponse = { id: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function defaultSubjectForOtpType(type: string): string {
  switch (type) {
    case "sign-in":
      return "Your sign-in code";
    case "email-verification":
      return "Verify your email";
    case "password-reset":
      return "Reset your password";
    case "change-email":
      return "Confirm your email change";
    default:
      return "Your verification code";
  }
}

function defaultOtpHtml(otp: string, type: string): string {
  const heading = escapeHtml(defaultSubjectForOtpType(type));
  const otpEscaped = escapeHtml(otp);
  return `<!doctype html>
<html>
  <body>
    <h1>${heading}</h1>
    <p>Your verification code is:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otpEscaped}</p>
    <p>If you did not request this code, you can ignore this email.</p>
  </body>
</html>`;
}

function defaultOtpText(otp: string, type: string): string {
  return `${defaultSubjectForOtpType(type)}\n\nYour verification code is: ${otp}\n\nIf you did not request this code, you can ignore this email.`;
}

/**
 * Create a first-party Resend {@link EmailSender} for Convex actions.
 *
 * The returned function calls the Resend `POST /emails` endpoint and returns
 * the Resend email id. Errors are thrown as `Error` with a concise message so
 * callers can decide how to surface them to users.
 */
export function createResendEmailSender(
  options: ResendEmailSenderOptions,
): EmailSender {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const defaultFrom = options.from;
  return async (draft: EmailDraft) => {
    const from = draft.from || defaultFrom;
    if (!from) {
      throw new Error("Resend sender requires a 'from' address");
    }

    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: draft.to,
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Resend email send failed (${response.status}): ${body.slice(0, 200)}`,
      );
    }

    const result = (await response.json()) as ResendEmailSendResponse;
    return result.id;
  };
}

export type ResendEmailOtpSenderOptions = ResendEmailSenderOptions & {
  /**
   * Optional subject builder. Defaults to a type-specific subject such as
   * "Your sign-in code".
   */
  buildSubject?: (type: string) => string;
  /** Optional HTML builder. Defaults to a minimal branded template. */
  buildHtml?: (otp: string, type: string) => string;
  /** Optional plain-text builder. Defaults to a minimal plain-text template. */
  buildText?: (otp: string, type: string) => string;
};

/**
 * Create a first-party Resend {@link EmailOtpSender} for Convex actions.
 *
 * This wraps {@link createResendEmailSender} and renders a minimal OTP email
 * from the `otp` and `type` fields. Consumers can override the templates via
 * `buildSubject`, `buildHtml`, and `buildText`.
 */
export function createResendEmailOtpSender(
  options: ResendEmailOtpSenderOptions,
): EmailOtpSender {
  const sendEmail = createResendEmailSender(options);
  const buildSubject = options.buildSubject ?? defaultSubjectForOtpType;
  const buildHtml = options.buildHtml ?? defaultOtpHtml;
  const buildText = options.buildText ?? defaultOtpText;

  return async ({ email, otp, type }) => {
    const from = options.from;
    if (!from) {
      throw new Error("Resend OTP sender requires a 'from' address");
    }

    return await sendEmail({
      from,
      to: email,
      subject: buildSubject(type),
      html: buildHtml(otp, type),
      text: buildText(otp, type),
    });
  };
}
