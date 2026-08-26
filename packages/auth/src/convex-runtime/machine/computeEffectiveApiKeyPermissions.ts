import { intersectPermissions } from "../../compat/permissions";

import type { ApiKeyRecord } from "./types";

export function computeEffectiveApiKeyPermissions(args: {
  ownerPermissions: readonly string[];
  apiKey: Pick<ApiKeyRecord, "permissions">;
}): string[] {
  const narrowedPermissions = args.apiKey.permissions;

  if (narrowedPermissions === null) {
    return [...args.ownerPermissions];
  }

  return intersectPermissions(args.ownerPermissions, narrowedPermissions);
}
