import {
  clearPendingPostSignUpSync as clearPendingPostSignUpSyncStorage,
  getBrowserSessionStorage,
  markPendingPostSignUpSync as markPendingPostSignUpSyncStorage,
  type PostSignUpStorageLike,
} from "./post-sign-up";

export type VortexAuthEventSurface =
  | "sign-in"
  | "sign-up"
  | "invite"
  | "choose-organization"
  | "runtime";

export type VortexAuthPendingFlow =
  | "sign-in"
  | "sign-up"
  | "choose-organization";

export type VortexAuthPendingFlowState = {
  redirectPath?: string;
};

export type VortexAuthStorageLike = PostSignUpStorageLike &
  Pick<Storage, "getItem" | "removeItem" | "setItem">;

export type VortexAuthEventCapture = (
  eventName: string,
  properties: { surface: VortexAuthEventSurface } & Record<string, unknown>
) => void;

export type VortexAuthRoutePaths = {
  signInPath: string;
  signUpPath: string;
  acceptInvitePath: string;
  postSignInPath: string;
  postSignUpPath: string;
  chooseOrganizationPath: string;
};

export type VortexAuthFlowStorage = {
  markPendingAuthFlow: (
    flow: VortexAuthPendingFlow,
    state?: VortexAuthPendingFlowState
  ) => void;
  consumePendingAuthFlow: (
    flow: VortexAuthPendingFlow
  ) => VortexAuthPendingFlowState | null;
  markPendingPostSignUpSync: () => void;
  clearPendingPostSignUpSync: () => void;
  toSafeRedirectPath: (
    redirectUrl: string | null | undefined
  ) => string | undefined;
};

export const VORTEX_AUTH_DEFAULT_ROUTE_PATHS = {
  signInPath: "/sign-in",
  signUpPath: "/sign-up",
  acceptInvitePath: "/accept-invite",
  postSignInPath: "/app",
  postSignUpPath: "/post-sign-up",
  chooseOrganizationPath: "/onboarding/choose-organization",
} as const satisfies VortexAuthRoutePaths;

const DEFAULT_STORAGE_KEY_PREFIX = "vortex.auth";

export function createVortexAuthRoutePaths(
  overrides: Partial<VortexAuthRoutePaths> = {}
): VortexAuthRoutePaths {
  return {
    ...VORTEX_AUTH_DEFAULT_ROUTE_PATHS,
    ...overrides,
  };
}

export function createVortexAuthFlowStorage(
  args: {
    storage?: VortexAuthStorageLike;
    storageKeyPrefix?: string;
    currentOrigin?: string;
  } = {}
): VortexAuthFlowStorage {
  const storageKeyPrefix = args.storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX;

  function getStorage(): VortexAuthStorageLike | undefined {
    return args.storage ?? getBrowserSessionStorage();
  }

  return {
    markPendingAuthFlow(flow, state = {}) {
      markVortexPendingAuthFlow({
        flow,
        state,
        storage: getStorage(),
        storageKeyPrefix,
      });
    },
    consumePendingAuthFlow(flow) {
      return consumeVortexPendingAuthFlow({
        flow,
        storage: getStorage(),
        storageKeyPrefix,
      });
    },
    markPendingPostSignUpSync() {
      markPendingPostSignUpSyncStorage({
        storage: getStorage(),
        pendingKey: getVortexPendingPostSignUpStorageKey(storageKeyPrefix),
      });
    },
    clearPendingPostSignUpSync() {
      clearPendingPostSignUpSyncStorage({
        storage: getStorage(),
        pendingKey: getVortexPendingPostSignUpStorageKey(storageKeyPrefix),
        failureKey: getVortexPostSignUpFailureStorageKey(storageKeyPrefix),
      });
    },
    toSafeRedirectPath(redirectUrl) {
      return toSafeVortexRedirectPath(redirectUrl, args.currentOrigin);
    },
  };
}

export function createVortexAuthEventCapture(
  captureEvent: (
    eventName: string,
    properties: { surface: VortexAuthEventSurface } & Record<string, unknown>
  ) => void
): VortexAuthEventCapture {
  return (eventName, properties) => {
    captureEvent(eventName, properties);
  };
}

export function toSafeVortexRedirectPath(
  redirectUrl: string | null | undefined,
  currentOrigin = getBrowserOrigin()
): string | undefined {
  if (!redirectUrl) {
    return undefined;
  }

  if (redirectUrl.startsWith("//")) {
    return undefined;
  }

  if (redirectUrl.startsWith("/")) {
    return redirectUrl;
  }

  if (!currentOrigin) {
    return undefined;
  }

  try {
    const parsed = new URL(redirectUrl, currentOrigin);
    if (parsed.origin !== currentOrigin) {
      return undefined;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export function getVortexPendingAuthFlowStorageKey(args: {
  flow: VortexAuthPendingFlow;
  storageKeyPrefix?: string;
}): string {
  return `${args.storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX}.pending.${args.flow}`;
}

export function getVortexPendingPostSignUpStorageKey(
  storageKeyPrefix?: string
): string {
  return `${storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX}.pending-post-sign-up`;
}

export function getVortexPostSignUpFailureStorageKey(
  storageKeyPrefix?: string
): string {
  return `${storageKeyPrefix ?? DEFAULT_STORAGE_KEY_PREFIX}.post-sign-up-failure`;
}

function markVortexPendingAuthFlow(args: {
  flow: VortexAuthPendingFlow;
  state: VortexAuthPendingFlowState;
  storage?: VortexAuthStorageLike;
  storageKeyPrefix?: string;
}): void {
  const payload: VortexAuthPendingFlowState = {};
  if (args.state.redirectPath) {
    payload.redirectPath = args.state.redirectPath;
  }

  args.storage?.setItem(
    getVortexPendingAuthFlowStorageKey({
      flow: args.flow,
      storageKeyPrefix: args.storageKeyPrefix,
    }),
    JSON.stringify(payload)
  );
}

function consumeVortexPendingAuthFlow(args: {
  flow: VortexAuthPendingFlow;
  storage?: VortexAuthStorageLike;
  storageKeyPrefix?: string;
}): VortexAuthPendingFlowState | null {
  const storageKey = getVortexPendingAuthFlowStorageKey({
    flow: args.flow,
    storageKeyPrefix: args.storageKeyPrefix,
  });
  const value = args.storage?.getItem(storageKey);
  if (!value) {
    return null;
  }

  args.storage?.removeItem(storageKey);

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const redirectPath = Reflect.get(parsed, "redirectPath");
    return typeof redirectPath === "string" ? { redirectPath } : {};
  } catch {
    return {};
  }
}

function getBrowserOrigin(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.origin;
}
