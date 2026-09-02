import { defineSchema } from "convex/server";
import { auth_identities, users } from "../schema/users.js";
import {
  authAccounts,
  authMagicLinkTokens,
  authRateLimits,
  authRefreshTokens,
  authSessions,
  authVerificationCodes,
  authVerifiers,
} from "../schema/native.js";

export default defineSchema({
  users,
  auth_identities,
  authAccounts,
  authSessions,
  authRefreshTokens,
  authVerificationCodes,
  authVerifiers,
  authRateLimits,
  authMagicLinkTokens,
});
