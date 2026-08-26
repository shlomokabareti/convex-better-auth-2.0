import {
  assembleViewerContext,
  type AssembledViewerContext,
  type ResolvedViewerAccess,
} from "./assembleViewerContext";
import type { ConvexUserIdentity } from "./resolveConvexUserContext";

export type ViewerLookupFailureCode =
  | "ANONYMOUS"
  | "LOCAL_IDENTITY_MISSING"
  | "SESSION_INVALID"
  | "USER_MISSING";

export type ViewerLookupFailure = {
  code: ViewerLookupFailureCode;
  message: string;
};

export type ViewerLookupResolvedPieces<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
> = {
  identity: TIdentity;
  localIdentity: TLocalIdentity;
  user: TUser;
  userId: string;
  identityId: string | null;
  access: ResolvedViewerAccess<TOrganizationId, TMembershipId>;
  isRestricted: boolean;
  restrictedReason: string | null;
};

export type ViewerLookupResult<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
> =
  | {
      ok: true;
      viewer: AssembledViewerContext<
        TIdentity,
        TLocalIdentity,
        TUser,
        TOrganizationId,
        TMembershipId
      >;
    }
  | {
      ok: false;
      failure: ViewerLookupFailure;
    };

export function anonymousViewerFailure(
  message = "Authentication required"
): ViewerLookupFailure {
  return {
    code: "ANONYMOUS",
    message,
  };
}

export function missingLocalIdentityFailure(
  message = "Local identity missing"
): ViewerLookupFailure {
  return {
    code: "LOCAL_IDENTITY_MISSING",
    message,
  };
}

export function invalidSessionFailure(
  message = "Active session required"
): ViewerLookupFailure {
  return {
    code: "SESSION_INVALID",
    message,
  };
}

export function missingUserFailure(
  message = "User not found"
): ViewerLookupFailure {
  return {
    code: "USER_MISSING",
    message,
  };
}

export function resolveViewerLookup<
  TIdentity extends ConvexUserIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId extends string | null = string | null,
  TMembershipId extends string = string,
>(
  args:
    | {
        failure: ViewerLookupFailure;
      }
    | {
        pieces: ViewerLookupResolvedPieces<
          TIdentity,
          TLocalIdentity,
          TUser,
          TOrganizationId,
          TMembershipId
        >;
      }
): ViewerLookupResult<
  TIdentity,
  TLocalIdentity,
  TUser,
  TOrganizationId,
  TMembershipId
> {
  if ("failure" in args) {
    return {
      ok: false,
      failure: args.failure,
    };
  }

  return {
    ok: true,
    viewer: assembleViewerContext(args.pieces),
  };
}
