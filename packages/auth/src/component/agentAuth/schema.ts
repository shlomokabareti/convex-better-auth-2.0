import { defineSchema } from "convex/server";
import * as agents from "../schema/agents.js";
import * as organizations from "../schema/organizations.js";
import * as users from "../schema/users.js";

export default defineSchema({
  ...users,
  ...organizations,
  ...agents,
});
