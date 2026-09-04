/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as identity from "../identity.js";
import type * as native_accounts from "../native/accounts.js";
import type * as native_codes from "../native/codes.js";
import type * as native_identities from "../native/identities.js";
import type * as native_rateLimits from "../native/rateLimits.js";
import type * as native_refreshTokens from "../native/refreshTokens.js";
import type * as native_sessions from "../native/sessions.js";
import type * as native_users from "../native/users.js";
import type * as native_verifiers from "../native/verifiers.js";
import type * as organizations from "../organizations.js";
import type * as scopes from "../scopes.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  identity: typeof identity;
  "native/accounts": typeof native_accounts;
  "native/codes": typeof native_codes;
  "native/identities": typeof native_identities;
  "native/rateLimits": typeof native_rateLimits;
  "native/refreshTokens": typeof native_refreshTokens;
  "native/sessions": typeof native_sessions;
  "native/users": typeof native_users;
  "native/verifiers": typeof native_verifiers;
  organizations: typeof organizations;
  scopes: typeof scopes;
  status: typeof status;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
