import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";

import type {
  ConvexAuthEventCapture,
  ConvexAuthPendingFlow,
  ConvexAuthPendingFlowState,
} from "./auth-flow";
import {
  ConvexAuthAcceptInvitePage,
  ConvexAuthOrganizationChooserPage,
  ConvexAuthPostSignUpPage,
  ConvexAuthSignInPage,
  ConvexAuthSignUpPage,
  type ConvexAuthInviteExceptionEvent,
  type ConvexAuthInviteFailureEvent,
  type ConvexAuthInviteOpenedEvent,
  type ConvexAuthInviteRedirectedEvent,
} from "./auth-pages";
import {
  AuthSignedInBoundary,
  AuthSignedOutBoundary,
  getConvexAuthActions,
  useAuthState,
  useConvexAuthUser,
  ConvexBetterAuthIdentityProvisioner,
  ConvexAuthRuntimeProvider,
  type ConvexAuthCaptureException,
  type ConvexAuthSocialProvider,
  type ConvexBetterAuthClient,
  type ConvexAuthState,
  type ConvexAuthUserState,
} from "./better-auth-runtime";
import { getAfterSignUpPath } from "./invite-sign-up";
import { useGuardedProtectedWrite } from "./protected-writes";

type ConvexClientLike = {
  setAuth(
    fetchToken: (args: { forceRefreshToken: boolean }) => Promise<string | null>
  ): void;
  clearAuth(): void;
};

type EmptyArgs = Record<string, never>;
type PendingAuthFlow = ConvexAuthPendingFlow;

type NavigateTo = (args: {
  to: string;
  replace?: boolean;
}) => void | Promise<void>;

type CaptureAuthEvent = ConvexAuthEventCapture;

type MarkPendingAuthFlow = (
  flow: PendingAuthFlow,
  state?: ConvexAuthPendingFlowState
) => void;

type CaptureException = ConvexAuthCaptureException;

type CurrentOrganizationRecord = {
  _id: string;
  name?: string | null;
};

type OrganizationChooserItemRecord = {
  _id: string;
  name: string;
  canSelect: boolean;
  roleTemplate?: string | null;
};

type InvitationLookupResult = {
  email?: string | null;
  expiresAt?: number | null;
  status?: string | null;
} | null;

export type ConvexBetterAuthConvexIdentityProvisionerProps = {
  auth: ConvexAuthState;
  authClient: ConvexBetterAuthClient | null;
  getCurrentUser: FunctionReference<"query", "public", EmptyArgs, unknown>;
  provisionCurrentUser: FunctionReference<
    "mutation",
    "public",
    EmptyArgs,
    unknown
  >;
};

export type ConvexBetterAuthRuntimeConvexIdentityProvisionerProps = Omit<
  ConvexBetterAuthConvexIdentityProvisionerProps,
  "auth" | "authClient"
>;

export type ConvexBetterAuthRuntimeCopy = {
  signInTitle?: string;
  signInDescription?: string;
  signInUnavailableTitle?: string;
  signInUnavailableDescription?: string;
  signUpTitle?: string;
  signUpDescription?: string;
  signUpUnavailableTitle?: string;
  signUpUnavailableDescription?: string;
};

export type ConvexBetterAuthSignInRoutePageProps = {
  signUpPath: string;
  postSignInPath: string;
  /** When set, sign-in form renders a forgot-password link to this href. */
  forgotPasswordHref?: string;
  markPendingAuthFlow?: MarkPendingAuthFlow;
  captureAuthEvent?: CaptureAuthEvent;
  captureException?: CaptureException;
};

export type ConvexBetterAuthSignUpRoutePageProps = {
  signInPath: string;
  postSignUpPath: string;
  markPendingAuthFlow?: MarkPendingAuthFlow;
  markPendingPostSignUpSync?: () => void;
  captureAuthEvent?: CaptureAuthEvent;
};

export type ConvexBetterAuthAcceptInviteRoutePageProps = {
  getInvitationByToken: FunctionReference<
    "action",
    "public",
    { token: string },
    InvitationLookupResult
  >;
  signInPath: string;
  signUpPath: string;
  postSignUpPath: string;
  toSafeRedirectPath?: (url: string) => string | undefined;
  captureAuthEvent?: CaptureAuthEvent;
  captureException?: CaptureException;
  title?: string;
  description?: string;
  eyebrow?: string;
};

export type ConvexBetterAuthPostSignUpRoutePageProps = {
  getDefaultOrganization: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    CurrentOrganizationRecord | null
  >;
  getAvailableOrganizations: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    readonly OrganizationChooserItemRecord[]
  >;
  ensureActiveOrganization: FunctionReference<
    "mutation",
    "public",
    EmptyArgs,
    unknown
  >;
  redeemInvitation: FunctionReference<
    "mutation",
    "public",
    { token: string },
    unknown
  >;
  navigate: NavigateTo;
  postSignInPath: string;
  chooseOrganizationPath: string;
  clearPendingPostSignUpSync?: () => void;
  consumePendingAuthFlow?: (
    flow: "sign-up"
  ) => { redirectPath?: string } | null;
  captureAuthEvent?: CaptureAuthEvent;
  title?: string;
  description?: string;
  eyebrow?: string;
  timeoutMs?: number;
};

export type ConvexBetterAuthOrganizationChooserRoutePageProps = {
  getDefaultOrganization: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    CurrentOrganizationRecord | null
  >;
  getAvailableOrganizations: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    readonly OrganizationChooserItemRecord[]
  >;
  setActiveOrganization: FunctionReference<
    "mutation",
    "public",
    { organizationId: string },
    unknown
  >;
  navigate: NavigateTo;
  postChooseOrganizationPath: string;
  markPendingAuthFlow?: MarkPendingAuthFlow;
  captureAuthEvent?: CaptureAuthEvent;
  title?: string;
  description?: string;
  eyebrow?: string;
  emptyDescription?: string;
};

export type ConvexBetterAuthAuthenticatedRouteGateRenderArgs = {
  organization: CurrentOrganizationRecord | null;
  isPostSignUpRoute: boolean;
};

export type ConvexBetterAuthAuthenticatedRouteGateProps = {
  getDefaultOrganization: FunctionReference<
    "query",
    "public",
    EmptyArgs,
    CurrentOrganizationRecord | null
  >;
  pathname: string;
  signInPath: string;
  chooseOrganizationPath: string;
  postSignUpPath: string;
  navigate: NavigateTo;
  children: (
    args: ConvexBetterAuthAuthenticatedRouteGateRenderArgs
  ) => ReactNode;
  renderLoading: () => ReactNode;
  renderOrganizationRequired: (args: {
    chooseOrganizationPath: string;
  }) => ReactNode;
  renderRedirectingToSignIn: () => ReactNode;
  consumePendingAuthFlow?: (
    flow: Extract<PendingAuthFlow, "sign-in" | "choose-organization">
  ) => { redirectPath?: string } | null;
  captureAuthEvent?: CaptureAuthEvent;
  toSafeRedirectPath?: (url: string) => string | undefined;
};

type ConvexBetterAuthRuntimeCreateArgs = {
  authClient: ConvexBetterAuthClient | null;
  betterAuthBaseUrl?: string | null;
  captureAuthEvent?: CaptureAuthEvent;
  captureException?: CaptureException;
  signInPath: string;
  signUpPath: string;
  copy?: ConvexBetterAuthRuntimeCopy;
  socialProviders?: readonly ConvexAuthSocialProvider[];
};

type ConvexBetterAuthRuntimeHooks = ReturnType<
  typeof createConvexBetterAuthRuntimeHooks
>;
type ConvexBetterAuthRuntimeScreens = ReturnType<
  typeof createConvexBetterAuthRuntimeScreens
>;

export function createConvexBetterAuthRuntime(
  args: ConvexBetterAuthRuntimeCreateArgs
) {
  const hooks = createConvexBetterAuthRuntimeHooks(args);
  const providers = createConvexBetterAuthProviderComponents(args, hooks);
  const screens = createConvexBetterAuthRuntimeScreens(args, hooks);
  const entryRoutes = createConvexBetterAuthEntryRoutePages(hooks, screens);
  const workspaceRoutes = createConvexBetterAuthWorkspaceRoutePages();
  const AuthenticatedRouteGate =
    createConvexBetterAuthAuthenticatedRouteGate(hooks);

  return {
    AuthRuntimeProvider: providers.RuntimeProvider,
    BetterAuthConvexIdentityProvisioner:
      providers.BetterAuthConvexIdentityProvisioner,
    AuthAcceptInviteRoutePage: entryRoutes.AcceptInviteRoutePage,
    AuthAuthenticatedRouteGate: AuthenticatedRouteGate,
    AuthOrganizationChooserRoutePage:
      workspaceRoutes.OrganizationChooserRoutePage,
    AuthPostSignUpRoutePage: workspaceRoutes.PostSignUpRoutePage,
    AuthSignInRoutePage: entryRoutes.SignInRoutePage,
    AuthSignUpRoutePage: entryRoutes.SignUpRoutePage,
    AuthSignedIn: providers.SignedIn,
    AuthSignedOut: providers.SignedOut,
    AuthSignInScreen: screens.SignInScreen,
    AuthSignUpScreen: screens.SignUpScreen,
    authClient: args.authClient,
    betterAuthBaseUrl: args.betterAuthBaseUrl ?? null,
    useAppAuth: hooks.useAuth,
    useAppAuthActions: hooks.useAuthActions,
    useAppUser: hooks.useUser,
  };
}

function createConvexBetterAuthRuntimeHooks(
  args: ConvexBetterAuthRuntimeCreateArgs
) {
  function useAuth() {
    return useAuthState(args.authClient);
  }

  function useUser(): ConvexAuthUserState {
    return useConvexAuthUser(args.authClient);
  }

  function useAuthActions() {
    return getConvexAuthActions({
      authClient: args.authClient,
      signInPath: args.signInPath,
      signUpPath: args.signUpPath,
    });
  }

  return { useAuth, useAuthActions, useUser };
}

function createConvexBetterAuthProviderComponents(
  args: ConvexBetterAuthRuntimeCreateArgs,
  hooks: ConvexBetterAuthRuntimeHooks
) {
  function RuntimeProvider(props: {
    children: ReactNode;
    convex: ConvexClientLike;
    identityProvisioner?: ReactNode;
  }) {
    return (
      <ConvexAuthRuntimeProvider
        authClient={args.authClient}
        betterAuthBaseUrl={args.betterAuthBaseUrl}
        captureAuthEvent={args.captureAuthEvent}
        captureException={args.captureException}
        convex={props.convex}
        identityProvisioner={props.identityProvisioner}
      >
        {props.children}
      </ConvexAuthRuntimeProvider>
    );
  }

  function SignedIn(props: { children: ReactNode }) {
    return (
      <AuthSignedInBoundary auth={hooks.useAuth()}>
        {props.children}
      </AuthSignedInBoundary>
    );
  }

  function SignedOut(props: { children: ReactNode }) {
    return (
      <AuthSignedOutBoundary auth={hooks.useAuth()}>
        {props.children}
      </AuthSignedOutBoundary>
    );
  }

  function RuntimeConvexIdentityProvisioner(
    props: ConvexBetterAuthRuntimeConvexIdentityProvisionerProps
  ) {
    return (
      <ConvexBetterAuthConvexIdentityProvisioner
        auth={hooks.useAuth()}
        authClient={args.authClient}
        getCurrentUser={props.getCurrentUser}
        provisionCurrentUser={props.provisionCurrentUser}
      />
    );
  }

  return {
    BetterAuthConvexIdentityProvisioner: RuntimeConvexIdentityProvisioner,
    RuntimeProvider,
    SignedIn,
    SignedOut,
  };
}

function createConvexBetterAuthRuntimeScreens(
  args: ConvexBetterAuthRuntimeCreateArgs,
  hooks: ConvexBetterAuthRuntimeHooks
) {
  function SignInScreen(props: {
    signUpUrl: string;
    forceRedirectUrl: string;
    forgotPasswordHref?: string;
    onOpened?: () => void;
    onRuntimeUnavailable?: () => void;
  }) {
    return (
      <ConvexAuthSignInPage
        auth={hooks.useAuth()}
        authClient={args.authClient}
        description={args.copy?.signInDescription}
        forceRedirectUrl={props.forceRedirectUrl}
        forgotPasswordHref={props.forgotPasswordHref}
        onOpened={props.onOpened}
        onRuntimeUnavailable={props.onRuntimeUnavailable}
        signUpUrl={props.signUpUrl}
        socialProviders={args.socialProviders}
        title={args.copy?.signInTitle}
        unavailableDescription={args.copy?.signInUnavailableDescription}
        unavailableTitle={args.copy?.signInUnavailableTitle}
      />
    );
  }

  function SignUpScreen(props: {
    signInUrl: string;
    forceRedirectUrl: string;
    onOpened?: () => void;
    onRuntimeUnavailable?: () => void;
  }) {
    return (
      <ConvexAuthSignUpPage
        auth={hooks.useAuth()}
        authClient={args.authClient}
        description={args.copy?.signUpDescription}
        forceRedirectUrl={props.forceRedirectUrl}
        onOpened={props.onOpened}
        onRuntimeUnavailable={props.onRuntimeUnavailable}
        signInUrl={props.signInUrl}
        socialProviders={args.socialProviders}
        title={args.copy?.signUpTitle}
        unavailableDescription={args.copy?.signUpUnavailableDescription}
        unavailableTitle={args.copy?.signUpUnavailableTitle}
      />
    );
  }

  return { SignInScreen, SignUpScreen };
}

function createConvexBetterAuthEntryRoutePages(
  hooks: ConvexBetterAuthRuntimeHooks,
  screens: ConvexBetterAuthRuntimeScreens
) {
  const SignInRoutePage = (props: ConvexBetterAuthSignInRoutePageProps) => {
    const Screen = screens.SignInScreen;
    return (
      <Screen
        signUpUrl={props.signUpPath}
        forceRedirectUrl={props.postSignInPath}
        forgotPasswordHref={props.forgotPasswordHref}
        onOpened={() => {
          props.markPendingAuthFlow?.("sign-in", {
            redirectPath: props.postSignInPath,
          });
          props.captureAuthEvent?.("auth_sign_in_opened", {
            surface: "sign-in",
            redirectPath: props.postSignInPath,
          });
        }}
        onRuntimeUnavailable={() => {
          props.captureException?.(new Error("Auth SDK failed to load"), {
            tags: { operation: "auth-sdk-load", surface: "sign-in" },
            level: "error",
          });
        }}
      />
    );
  };

  const SignUpRoutePage = (props: ConvexBetterAuthSignUpRoutePageProps) => {
    const Screen = screens.SignUpScreen;
    const redirectPath = useMemo(() => {
      if (typeof window === "undefined") {
        return props.postSignUpPath;
      }

      return getAfterSignUpPath(window.location.search, props.postSignUpPath);
    }, [props.postSignUpPath]);

    return (
      <Screen
        signInUrl={props.signInPath}
        forceRedirectUrl={redirectPath}
        onOpened={() => {
          props.markPendingPostSignUpSync?.();
          props.markPendingAuthFlow?.("sign-up", { redirectPath });
          props.captureAuthEvent?.("auth_sign_up_opened", {
            surface: "sign-up",
            redirectPath,
          });
        }}
      />
    );
  };

  function AcceptInviteRoutePage(
    props: ConvexBetterAuthAcceptInviteRoutePageProps
  ) {
    const { redirectToSignIn, buildSignUpUrl } = hooks.useAuthActions();
    const getInvitation = useAction(props.getInvitationByToken);
    const getInviteEmailAddress = useInviteEmailAddress(getInvitation);

    return (
      <ConvexAuthAcceptInvitePage
        buildSignUpUrl={buildSignUpUrl}
        redirectToSignIn={redirectToSignIn}
        signInPath={props.signInPath}
        signUpPath={props.signUpPath}
        postSignUpPath={props.postSignUpPath}
        getInvitationEmail={getInviteEmailAddress}
        toSafeRedirectPath={props.toSafeRedirectPath}
        title={props.title}
        description={props.description}
        eyebrow={props.eyebrow}
        onOpened={(event) =>
          captureInviteOpenedEvent(props.captureAuthEvent, event)
        }
        onRedirected={(event) =>
          captureInviteRedirectedEvent(props.captureAuthEvent, event)
        }
        onFailed={(event) =>
          captureInviteFailedEvent(props.captureAuthEvent, event)
        }
        onException={(event) =>
          captureInviteException(props.captureException, event)
        }
      />
    );
  }

  return { AcceptInviteRoutePage, SignInRoutePage, SignUpRoutePage };
}

function useInviteEmailAddress(
  getInvitation: (args: { token: string }) => Promise<InvitationLookupResult>
) {
  return useCallback(
    async (
      invitationToken: string,
      params: URLSearchParams
    ): Promise<string | null> => {
      try {
        const result = await getInvitation({ token: invitationToken });
        if (!isRedeemableInvitationLookupResult(result)) return null;

        const email = result.email?.trim();
        return (
          email || params.get("email_address") || params.get("email") || null
        );
      } catch {
        return null;
      }
    },
    [getInvitation]
  );
}

function createConvexBetterAuthWorkspaceRoutePages() {
  function PostSignUpRoutePage(
    props: ConvexBetterAuthPostSignUpRoutePageProps
  ) {
    const currentOrganization = useQuery(props.getDefaultOrganization, {});
    const availableOrganizations = useQuery(
      props.getAvailableOrganizations,
      {}
    );
    const ensureActiveOrganization = useGuardedProtectedWrite(
      useMutation(props.ensureActiveOrganization)
    );
    const redeemInvitation = useGuardedProtectedWrite(
      useMutation(props.redeemInvitation)
    );
    const invitationToken = useInvitationToken();
    const handleCurrentOrganizationReady =
      useCurrentOrganizationReadyHandler(props);

    useSignUpSuccessCapture(props);

    return (
      <ConvexAuthPostSignUpPage
        currentOrganization={currentOrganization}
        availableOrganizations={availableOrganizations}
        invitationToken={invitationToken}
        ensureActiveOrganization={async () =>
          await ensureActiveOrganization({})
        }
        redeemInvitation={async (token) => await redeemInvitation({ token })}
        onCurrentOrganizationReady={handleCurrentOrganizationReady}
        onOpenOrganizationSetup={() => openOrganizationSetup(props)}
        timeoutMs={props.timeoutMs}
        title={props.title}
        description={props.description}
        eyebrow={props.eyebrow}
      />
    );
  }

  function OrganizationChooserRoutePage(
    props: ConvexBetterAuthOrganizationChooserRoutePageProps
  ) {
    const currentOrganization = useQuery(props.getDefaultOrganization, {});
    const organizations = useQuery(props.getAvailableOrganizations, {});
    const setActiveOrganization = useGuardedProtectedWrite(
      useMutation(props.setActiveOrganization)
    );

    useOrganizationChooserOpenedCapture(props);

    return (
      <ConvexAuthOrganizationChooserPage
        currentOrganization={currentOrganization}
        organizations={organizations}
        onSelectOrganization={async (item) => {
          await setActiveOrganization({ organizationId: item._id });
          props.captureAuthEvent?.("auth_choose_organization_submitted", {
            surface: "choose-organization",
            organizationId: item._id,
          });
          await props.navigate({ to: props.postChooseOrganizationPath });
        }}
        title={props.title}
        description={
          props.description ??
          `Select active organization. Current resolved org: ${currentOrganization?.name ?? "none"}.`
        }
        eyebrow={props.eyebrow}
        emptyDescription={props.emptyDescription}
      />
    );
  }

  return { OrganizationChooserRoutePage, PostSignUpRoutePage };
}

function useInvitationToken(): string | null {
  return useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new URLSearchParams(window.location.search).get("invitation_token");
  }, []);
}

function useCurrentOrganizationReadyHandler(
  props: ConvexBetterAuthPostSignUpRoutePageProps
) {
  const { clearPendingPostSignUpSync, navigate, postSignInPath } = props;

  return useCallback(() => {
    clearPendingPostSignUpSync?.();
    void navigate({ to: postSignInPath, replace: true });
  }, [clearPendingPostSignUpSync, navigate, postSignInPath]);
}

function useSignUpSuccessCapture(
  props: ConvexBetterAuthPostSignUpRoutePageProps
): void {
  const { captureAuthEvent, consumePendingAuthFlow, postSignInPath } = props;

  useEffect(() => {
    const pendingSignUp = consumePendingAuthFlow?.("sign-up");
    if (!pendingSignUp) return;

    captureAuthEvent?.("auth_sign_up_succeeded", {
      surface: "sign-up",
      redirectPath: pendingSignUp.redirectPath ?? postSignInPath,
    });
  }, [captureAuthEvent, consumePendingAuthFlow, postSignInPath]);
}

function openOrganizationSetup(
  props: ConvexBetterAuthPostSignUpRoutePageProps
): void {
  props.clearPendingPostSignUpSync?.();
  void props.navigate({ to: props.chooseOrganizationPath });
}

function useOrganizationChooserOpenedCapture(
  props: ConvexBetterAuthOrganizationChooserRoutePageProps
): void {
  const { captureAuthEvent, markPendingAuthFlow, postChooseOrganizationPath } =
    props;

  useEffect(() => {
    markPendingAuthFlow?.("choose-organization", {
      redirectPath: postChooseOrganizationPath,
    });
    captureAuthEvent?.("auth_choose_organization_opened", {
      surface: "choose-organization",
      redirectPath: postChooseOrganizationPath,
    });
  }, [captureAuthEvent, markPendingAuthFlow, postChooseOrganizationPath]);
}

function createConvexBetterAuthAuthenticatedRouteGate(
  hooks: ConvexBetterAuthRuntimeHooks
) {
  function AuthenticatedRouteGate(
    props: ConvexBetterAuthAuthenticatedRouteGateProps
  ) {
    const auth = hooks.useAuth();
    const organization = useQuery(
      props.getDefaultOrganization,
      auth.isSignedIn ? {} : "skip"
    );
    const routeState = createAuthenticatedRouteState(props, auth, organization);

    useSignedOutRedirectEffect(props, auth);
    useAuthenticatedRouteSuccessCapture(props, auth, organization, routeState);

    if (routeState.showLoading) return props.renderLoading();
    if (!auth.isSignedIn) return props.renderRedirectingToSignIn();
    if (routeState.showOrganizationRequired) {
      return props.renderOrganizationRequired({
        chooseOrganizationPath: props.chooseOrganizationPath,
      });
    }

    return props.children({
      organization: organization ?? null,
      isPostSignUpRoute: routeState.isPostSignUpRoute,
    });
  }

  return AuthenticatedRouteGate;
}

function createAuthenticatedRouteState(
  props: ConvexBetterAuthAuthenticatedRouteGateProps,
  auth: ConvexAuthState,
  organization: CurrentOrganizationRecord | null | undefined
) {
  const isPostSignUpRoute = props.pathname.startsWith(props.postSignUpPath);
  const isChooseOrganizationRoute = props.pathname.startsWith(
    props.chooseOrganizationPath
  );
  const isOrganizationLoading = auth.isSignedIn && organization === undefined;

  return {
    isOrganizationLoading,
    isPostSignUpRoute,
    showLoading: shouldShowConvexAuthenticatedRouteLoading({
      isAuthLoaded: auth.isLoaded,
      isOrganizationLoading,
      isPostSignUpRoute,
    }),
    showOrganizationRequired:
      shouldShowConvexAuthenticatedRouteOrganizationRequired({
        hasOrganization: Boolean(organization),
        isChooseOrganizationRoute,
        isPostSignUpRoute,
      }),
  };
}

function useSignedOutRedirectEffect(
  props: ConvexBetterAuthAuthenticatedRouteGateProps,
  auth: ConvexAuthState
): void {
  const { navigate, signInPath } = props;

  useEffect(() => {
    if (!auth.isLoaded || auth.isSignedIn) return;

    void navigate({ to: signInPath, replace: true });
  }, [auth.isLoaded, auth.isSignedIn, navigate, signInPath]);
}

function useAuthenticatedRouteSuccessCapture(
  props: ConvexBetterAuthAuthenticatedRouteGateProps,
  auth: ConvexAuthState,
  organization: CurrentOrganizationRecord | null | undefined,
  routeState: ReturnType<typeof createAuthenticatedRouteState>
): void {
  const {
    captureAuthEvent,
    consumePendingAuthFlow,
    pathname,
    toSafeRedirectPath,
  } = props;
  const { isOrganizationLoading } = routeState;

  useEffect(() => {
    if (
      !shouldCaptureConvexAuthenticatedRouteSuccess({
        isAuthLoaded: auth.isLoaded,
        isSignedIn: auth.isSignedIn,
        isOrganizationLoading,
      })
    ) {
      return;
    }

    captureAuthenticatedRouteSuccess(
      {
        captureAuthEvent,
        consumePendingAuthFlow,
        pathname,
        toSafeRedirectPath,
      },
      organization
    );
  }, [
    auth.isLoaded,
    auth.isSignedIn,
    captureAuthEvent,
    consumePendingAuthFlow,
    isOrganizationLoading,
    organization,
    pathname,
    toSafeRedirectPath,
  ]);
}

function captureAuthenticatedRouteSuccess(
  props: Pick<
    ConvexBetterAuthAuthenticatedRouteGateProps,
    | "captureAuthEvent"
    | "consumePendingAuthFlow"
    | "pathname"
    | "toSafeRedirectPath"
  >,
  organization: CurrentOrganizationRecord | null | undefined
): void {
  const currentRedirectPath = getBrowserCurrentRedirectPath(props.pathname);
  const pendingSignIn = props.consumePendingAuthFlow?.("sign-in");
  if (pendingSignIn) {
    props.captureAuthEvent?.("auth_sign_in_succeeded", {
      surface: "sign-in",
      redirectPath:
        props.toSafeRedirectPath?.(currentRedirectPath) ??
        pendingSignIn.redirectPath,
    });
  }

  if (!organization) return;

  const pendingChooseOrganization = props.consumePendingAuthFlow?.(
    "choose-organization"
  );
  if (!pendingChooseOrganization) return;

  props.captureAuthEvent?.("auth_choose_organization_completed", {
    surface: "choose-organization",
    redirectPath:
      props.toSafeRedirectPath?.(currentRedirectPath) ??
      pendingChooseOrganization.redirectPath,
  });
}

export function ConvexBetterAuthConvexIdentityProvisioner(
  args: ConvexBetterAuthConvexIdentityProvisionerProps
) {
  const currentUser = useQuery(
    args.getCurrentUser,
    args.auth.isSignedIn ? {} : "skip"
  );
  const provisionMutation = useGuardedProtectedWrite(
    useMutation(args.provisionCurrentUser)
  );
  const session = args.authClient?.useSession();

  return (
    <ConvexBetterAuthIdentityProvisioner
      auth={args.auth}
      currentUser={currentUser}
      provisionCurrentUser={async () => await provisionMutation({})}
      sessionSubject={session?.data?.user.id ?? null}
    />
  );
}

function captureInviteOpenedEvent(
  captureAuthEvent: CaptureAuthEvent | undefined,
  event: ConvexAuthInviteOpenedEvent
) {
  captureAuthEvent?.("auth_invite_opened", {
    surface: "invite",
    hasTicket: true,
    redirectPath: event.redirectPath,
  });
}

function captureInviteRedirectedEvent(
  captureAuthEvent: CaptureAuthEvent | undefined,
  event: ConvexAuthInviteRedirectedEvent
) {
  captureAuthEvent?.("auth_invite_redirected", {
    surface: "invite",
    hasTicket: true,
    redirectPath: event.redirectPath,
  });
}

function captureInviteFailedEvent(
  captureAuthEvent: CaptureAuthEvent | undefined,
  event: ConvexAuthInviteFailureEvent
) {
  captureAuthEvent?.("auth_invite_failed", {
    surface: "invite",
    hasTicket: event.hasTicket,
    reason: event.reason,
    redirectPath: event.redirectPath,
  });
}

function captureInviteException(
  captureException: CaptureException | undefined,
  event: ConvexAuthInviteExceptionEvent
) {
  captureException?.(event.error, {
    tags: {
      operation: "accept-invite",
      step: event.step,
    },
    extra: { hasTicket: event.hasTicket },
    level: event.step === "retry-sign-up" ? "warning" : "error",
  });
}

function isRedeemableInvitationLookupResult(
  result: InvitationLookupResult
): result is {
  email?: string | null;
  expiresAt?: number | null;
  status?: string | null;
} {
  if (result === null) {
    return false;
  }

  if (
    result.status !== undefined &&
    result.status !== null &&
    result.status !== "pending"
  ) {
    return false;
  }

  return typeof result.expiresAt !== "number" || result.expiresAt > Date.now();
}

export function shouldShowConvexAuthenticatedRouteOrganizationRequired(args: {
  hasOrganization: boolean;
  isChooseOrganizationRoute: boolean;
  isPostSignUpRoute: boolean;
}): boolean {
  return (
    !args.hasOrganization &&
    !args.isChooseOrganizationRoute &&
    !args.isPostSignUpRoute
  );
}

export function shouldShowConvexAuthenticatedRouteLoading(args: {
  isAuthLoaded: boolean;
  isOrganizationLoading: boolean;
  isPostSignUpRoute: boolean;
}): boolean {
  return (
    !args.isAuthLoaded ||
    (args.isOrganizationLoading && !args.isPostSignUpRoute)
  );
}

export function shouldCaptureConvexAuthenticatedRouteSuccess(args: {
  isAuthLoaded: boolean;
  isSignedIn: boolean;
  isOrganizationLoading: boolean;
}): boolean {
  return args.isAuthLoaded && args.isSignedIn && !args.isOrganizationLoading;
}

export function getConvexAuthenticatedRouteRedirectPath(args: {
  pathname: string;
  search?: string;
  hash?: string;
}): string {
  return `${args.pathname}${args.search ?? ""}${args.hash ?? ""}`;
}

function getBrowserCurrentRedirectPath(fallbackPathname: string): string {
  if (typeof window === "undefined") {
    return fallbackPathname;
  }

  return getConvexAuthenticatedRouteRedirectPath({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });
}
