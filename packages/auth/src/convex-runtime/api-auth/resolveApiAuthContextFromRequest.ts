import { getRequestIpFromHeaders } from "../machine";
import { parseApiCredential } from "./parseApiCredential";
import { resolveApiAuthContext } from "./resolveApiAuthContext";
import type { ApiBearerCredential, ResolveApiAuthContextArgs } from "./types";

export type ApiAuthRequestHeaders = Pick<Headers, "get">;

export type ApiAuthRequestLike = {
  headers: ApiAuthRequestHeaders;
};

export type ParseApiCredentialFromHeadersArgs = {
  apiKeyHeader?: string | null;
  apiKeyTokenPrefixes?: readonly string[];
  authorizationHeader?: string | null;
  headers?: ApiAuthRequestHeaders | null;
  request?: ApiAuthRequestLike | null;
};

export type ResolveApiAuthContextFromRequestArgs = Omit<
  ResolveApiAuthContextArgs,
  "credential" | "requestIp"
> &
  ParseApiCredentialFromHeadersArgs & {
    requestIp?: string | null;
  };

export function parseApiCredentialFromHeaders(
  args: ParseApiCredentialFromHeadersArgs
): ApiBearerCredential {
  const headers = resolveHeaders(args);

  return parseApiCredential({
    authorizationHeader:
      args.authorizationHeader ?? headers?.get("Authorization") ?? null,
    apiKeyHeader: args.apiKeyHeader ?? headers?.get("X-API-Key") ?? null,
    apiKeyTokenPrefixes: args.apiKeyTokenPrefixes,
  });
}

export async function resolveApiAuthContextFromRequest(
  args: ResolveApiAuthContextFromRequestArgs
) {
  const headers = resolveHeaders(args);
  const credential = parseApiCredentialFromHeaders(args);

  return await resolveApiAuthContext({
    adapter: args.adapter,
    credential,
    organizationHintId: args.organizationHintId,
    requestedOrganizationId: args.requestedOrganizationId,
    requestIp:
      args.requestIp ??
      (headers === null ? null : getRequestIpFromHeaders(headers)),
    resourceId: args.resourceId,
    resourceType: args.resourceType,
    verifier: args.verifier,
  });
}

function resolveHeaders(args: {
  headers?: ApiAuthRequestHeaders | null;
  request?: ApiAuthRequestLike | null;
}): ApiAuthRequestHeaders | null {
  return args.headers ?? args.request?.headers ?? null;
}
