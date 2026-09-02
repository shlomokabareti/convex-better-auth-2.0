import { defineSchema } from "convex/server";
import {
  organization_invitations,
  organization_members,
  organization_roles,
  organizations,
} from "../schema/organizations.js";

export default defineSchema({
  organizations,
  organization_roles,
  organization_members,
  organization_invitations,
});
