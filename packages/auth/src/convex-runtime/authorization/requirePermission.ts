import type { ResolvedAuthContext } from "../coreTypes";
import { authorizePermission } from "./authorize";

export function requirePermission(context: ResolvedAuthContext, permission: string): void {
  const decision = authorizePermission(context, permission);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? `Permission required: ${permission}`);
  }
}
