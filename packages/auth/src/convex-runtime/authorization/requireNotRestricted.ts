import type { ResolvedAuthContext } from "../coreTypes";
import { authorizeNotRestricted } from "./authorize";

export function requireNotRestricted(context: ResolvedAuthContext): void {
  const decision = authorizeNotRestricted(context);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "Principal is restricted");
  }
}
