import {
  extractAuthorizationDeniedAuditPayload,
  type AuthorizationDeniedAuditPayload,
} from "./authorizationDeniedPayload";

export async function rethrowWithAuthorizationDeniedAudit(args: {
  error: unknown;
  writeAudit: (payload: AuthorizationDeniedAuditPayload) => Promise<void>;
}): Promise<never> {
  const audit = extractAuthorizationDeniedAuditPayload(args.error);

  if (audit !== null) {
    await args.writeAudit(audit);
  }

  throw args.error;
}
