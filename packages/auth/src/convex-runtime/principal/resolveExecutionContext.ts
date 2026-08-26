import type { ExecutionContext } from "../coreTypes";
import type { PrincipalResolutionInput } from "./types";

export function resolveExecutionContext(
  input: PrincipalResolutionInput
): ExecutionContext {
  return {
    organizationId: input.organizationId ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    audience: input.audience ?? null,
    scopes: input.scopes ?? [],
  };
}
