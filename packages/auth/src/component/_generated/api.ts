/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentAuth from "../agentAuth.js";
import type * as apiKeys from "../apiKeys.js";
import type * as authMd from "../authMd.js";
import type * as convex_src_machine_apiKeySecret from "../convex/src/machine/apiKeySecret.js";
import type * as identity from "../identity.js";
import type * as mcp from "../mcp.js";
import type * as native_accounts from "../native/accounts.js";
import type * as native_codes from "../native/codes.js";
import type * as native_identities from "../native/identities.js";
import type * as native_sessions from "../native/sessions.js";
import type * as native_users from "../native/users.js";
import type * as organizations from "../organizations.js";
import type * as scopes from "../scopes.js";
import type * as servicePrincipals from "../servicePrincipals.js";
import type * as status from "../status.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  agentAuth: typeof agentAuth;
  apiKeys: typeof apiKeys;
  authMd: typeof authMd;
  "convex/src/machine/apiKeySecret": typeof convex_src_machine_apiKeySecret;
  identity: typeof identity;
  mcp: typeof mcp;
  "native/accounts": typeof native_accounts;
  "native/codes": typeof native_codes;
  "native/identities": typeof native_identities;
  "native/sessions": typeof native_sessions;
  "native/users": typeof native_users;
  organizations: typeof organizations;
  scopes: typeof scopes;
  servicePrincipals: typeof servicePrincipals;
  status: typeof status;
  webhooks: typeof webhooks;
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

export const components = componentsGeneric() as unknown as {};
