import type { AuthRuntimeStatus } from "convex-better-auth";
import { useContext } from "react";

import { AuthRuntimeContext } from "./AuthRuntimeProvider";

export function useAuthRuntimeStatus(): AuthRuntimeStatus {
  return useContext(AuthRuntimeContext).status;
}
