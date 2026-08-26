import type { ApiResolvedAuthContext, VerifiedUserToken } from "../coreTypes";
import { ApiAuthError } from "./errors";
import { resolveApiAuthContext } from "./resolveApiAuthContext";
import type { ResolveApiAuthContextArgs } from "./types";

export type ResolveVerifiedUserBearerAuthContextArgs = Omit<
  ResolveApiAuthContextArgs,
  "credential"
> & {
  token: string;
  verifiedToken?: VerifiedUserToken;
};

export type VerifiedUserBearerAuthContextResolution = {
  verifiedToken: VerifiedUserToken;
  context: ApiResolvedAuthContext;
};

export async function resolveVerifiedUserBearerAuthContext(
  args: ResolveVerifiedUserBearerAuthContextArgs,
): Promise<VerifiedUserBearerAuthContextResolution> {
  const verifiedToken = args.verifiedToken ?? (await verifyUserBearerToken(args));
  const context = await resolveApiAuthContext({
    adapter: args.adapter,
    credential: {
      credentialType: "userBearer",
      token: args.token,
    },
    organizationHintId: args.organizationHintId,
    requestedOrganizationId: args.requestedOrganizationId,
    requestIp: args.requestIp,
    resourceId: args.resourceId,
    resourceType: args.resourceType,
    verifier: {
      async verifyUserBearerToken() {
        return verifiedToken;
      },
    },
  });

  return { verifiedToken, context };
}

async function verifyUserBearerToken(
  args: Pick<ResolveApiAuthContextArgs, "verifier"> & { token: string },
): Promise<VerifiedUserToken> {
  try {
    return await args.verifier.verifyUserBearerToken(args.token);
  } catch (error) {
    throw new ApiAuthError("API_CREDENTIAL_INVALID", "User bearer credential is invalid.", {
      cause: error,
    });
  }
}
