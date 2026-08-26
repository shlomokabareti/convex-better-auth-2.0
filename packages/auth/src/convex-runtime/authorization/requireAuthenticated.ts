import type { ResolvedAuthContext } from "../coreTypes";
import { authorizeAuthenticated } from "./authorize";

export function requireAuthenticated(context: ResolvedAuthContext): void {
  const decision = authorizeAuthenticated(context);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "Authentication required");
  }
}
