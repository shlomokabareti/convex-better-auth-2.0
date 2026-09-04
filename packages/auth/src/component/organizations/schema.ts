import { defineSchema } from "convex/server";
import { auth_identities, users } from "../schema/users.js";
import {
  organizations,
  organization_invitations,
  organization_members,
  organization_roles,
} from "../schema/organizations.js";
import {
  authAccounts,
  authMagicLinkTokens,
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
  authMagicLinkTokens,
  organizations,
  organization_roles,
  organization_members,
  organization_invitations,
});
