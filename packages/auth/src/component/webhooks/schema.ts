import { defineSchema } from "convex/server";
import * as organizations from "../schema/organizations.js";
import * as users from "../schema/users.js";
import * as webhooks from "../schema/webhooks.js";

export default defineSchema({
  ...users,
  ...organizations,
  ...webhooks,
});
