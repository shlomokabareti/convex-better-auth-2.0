import { defineSchema } from "convex/server";
import * as authMd from "../schema/authMd.js";
import * as organizations from "../schema/organizations.js";
import * as users from "../schema/users.js";

export default defineSchema({
  ...users,
  ...organizations,
  ...authMd,
});
