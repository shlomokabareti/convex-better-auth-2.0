import type { AuthReadinessState } from "convex-better-auth";

import { useAuthRuntimeStatus } from "./useAuthRuntimeStatus";

export function useAuthStateMatches(
  ...states: readonly AuthReadinessState[]
): boolean {
  return states.includes(useAuthRuntimeStatus().state);
}
