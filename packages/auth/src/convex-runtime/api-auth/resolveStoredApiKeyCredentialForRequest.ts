import {
  getRequestIpFromHeaders,
  resolveApiKeyIpAllowlist,
  resolveStoredApiKeyCredential,
  type ResolveStoredApiKeyCredentialResult,
  type StoredApiKeyCredential,
} from "../machine";
import { ApiAuthError } from "./errors";
import type { ApiAuthRequestHeaders, ApiAuthRequestLike } from "./resolveApiAuthContextFromRequest";

export type StoredApiKeyCredentialWithIpAllowlist = StoredApiKeyCredential & {
  allowedIpRanges?: readonly string[] | null;
};

export type ResolveStoredApiKeyCredentialForRequestArgs<
  TApiKey extends StoredApiKeyCredentialWithIpAllowlist,
> = {
  findByKeyPrefix: (keyPrefix: string) => Promise<TApiKey | null>;
  hashSecret?: (secret: string) => Promise<string>;
  headers?: ApiAuthRequestHeaders | null;
  now?: number;
  request?: ApiAuthRequestLike | null;
  requestIp?: string | null;
  token: string;
};

export type ResolveStoredApiKeyCredentialForRequestResult<
  TApiKey extends StoredApiKeyCredentialWithIpAllowlist,
> = {
  apiKey: TApiKey;
  keyPrefix: string;
  requestIp: string | null;
};

export async function resolveStoredApiKeyCredentialForRequest<
  TApiKey extends StoredApiKeyCredentialWithIpAllowlist,
>(
  args: ResolveStoredApiKeyCredentialForRequestArgs<TApiKey>,
): Promise<ResolveStoredApiKeyCredentialForRequestResult<TApiKey>> {
  const credential = await resolveStoredApiKeyCredential({
    findByKeyPrefix: args.findByKeyPrefix,
    hashSecret: args.hashSecret,
    now: args.now,
    token: args.token,
  });

  assertStoredApiKeyCredential(credential);

  const requestIp = args.requestIp ?? getRequestIp(args);
  const allowedIpRanges = credential.apiKey.allowedIpRanges ?? [];
  const allowlist = resolveApiKeyIpAllowlist({ requestIp, allowedIpRanges });

  if (!allowlist.ok) {
    throw new ApiAuthError(
      allowlist.reason === "missing_ip" ? "API_KEY_IP_MISSING" : "API_KEY_IP_FORBIDDEN",
      allowlist.reason === "missing_ip"
        ? "API key requires a request IP."
        : "Request IP is not allowed for this API key.",
    );
  }

  return {
    apiKey: credential.apiKey,
    keyPrefix: credential.keyPrefix,
    requestIp: allowlist.requestIp,
  };
}

function assertStoredApiKeyCredential<TApiKey extends StoredApiKeyCredential>(
  credential: ResolveStoredApiKeyCredentialResult<TApiKey>,
): asserts credential is Extract<ResolveStoredApiKeyCredentialResult<TApiKey>, { ok: true }> {
  if (credential.ok) {
    return;
  }

  throw new ApiAuthError(
    credential.reason === "expired" ? "API_KEY_EXPIRED" : "API_KEY_INVALID",
    credential.reason === "expired" ? "API key is expired." : "API key is invalid.",
  );
}

function getRequestIp(args: {
  headers?: ApiAuthRequestHeaders | null;
  request?: ApiAuthRequestLike | null;
}): string | null {
  const headers = args.headers ?? args.request?.headers ?? null;
  return headers === null ? null : getRequestIpFromHeaders(headers);
}
