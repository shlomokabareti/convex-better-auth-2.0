import { defineSchema } from "convex/server";
import { api_keys, auth_audit_events } from "../schema/apiKeys.js";
import { organizations } from "../schema/organizations.js";
import { service_principals } from "../schema/servicePrincipals.js";
import { users } from "../schema/users.js";

export default defineSchema({
  users,
  organizations,
  service_principals,
  api_keys,
  auth_audit_events,
});
