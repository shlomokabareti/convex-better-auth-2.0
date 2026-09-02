import { defineSchema } from "convex/server";
import { organizations } from "../schema/organizations.js";
import { service_principals } from "../schema/servicePrincipals.js";
import { users } from "../schema/users.js";

export default defineSchema({
  users,
  organizations,
  service_principals,
});
