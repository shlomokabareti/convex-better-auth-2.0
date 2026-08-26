import { useConvexAuth, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { VortexExpoAuthRuntime } from "./runtime";
import { parseVortexExpoSessionRestore } from "./session-restore";
import { VortexVerifyTwoFactorForm } from "./vortex-verify-two-factor-form";

// Automated e2e (agent-device) cannot commit text into an iOS RN
// secureTextEntry field. ONLY when an explicit test build sets
// EXPO_PUBLIC_E2E_DISABLE_SECURE_ENTRY=true do we drop secure entry so
// the native auth flow is automatable. Production never sets this, so
// the password field stays fully secure. Same prod-safe, env-gated
// pattern as ENABLE_DEVELOPMENT_TESTING_MUTATIONS.
const SECURE_TEXT_ENTRY =
  process.env.EXPO_PUBLIC_E2E_DISABLE_SECURE_ENTRY !== "true";

type HostedCopy = {
  description?: string;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  title: string;
};

function HostedAuthHeader({ copy }: { copy: HostedCopy }) {
  return (
    <>
      <Text className="text-foreground" style={styles.title}>
        {copy.title}
      </Text>
      <Text className="text-muted-foreground" style={styles.description}>
        {copy.description}
      </Text>
    </>
  );
}

function HostedAuthError({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <View
      className="bg-destructive/10 border-destructive/30"
      style={styles.errorBox}
    >
      <Text className="text-destructive" style={styles.errorText}>
        {error}
      </Text>
    </View>
  );
}

function HostedAuthModeLink({
  label,
  onPress,
  strongLabel,
  testID,
}: {
  label: string;
  onPress?: () => void;
  strongLabel: string;
  testID: string;
}) {
  if (!onPress) {
    return null;
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.linkButton}
      testID={testID}
    >
      <Text className="text-muted-foreground" style={styles.linkText}>
        {label}{" "}
        <Text className="text-foreground" style={styles.linkTextStrong}>
          {strongLabel}
        </Text>
      </Text>
    </TouchableOpacity>
  );
}

export type HostedOrganization = {
  _id: string;
  canSelect?: boolean;
  name: string;
  roleTemplate?: string | null;
};

export type HostedInvitationLookup = {
  email: string;
  expiresAt: number;
  organizationId: string;
  status: string;
};

function useHostedInvitationLookup(args: {
  invitationToken: string | null | undefined;
  lookupInvitation: (token: string) => Promise<HostedInvitationLookup | null>;
}) {
  const [lookup, setLookup] = useState<
    HostedInvitationLookup | null | undefined
  >(undefined);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const { invitationToken, lookupInvitation } = args;

  useEffect(() => {
    if (!invitationToken) {
      setLookup(null);
      return undefined;
    }

    let cancelled = false;
    setLookup(undefined);
    setLookupError(null);
    void lookupInvitation(invitationToken)
      .then((result) => {
        if (!cancelled) setLookup(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLookup(null);
          setLookupError(
            error instanceof Error ? error.message : "Could not load invitation"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [invitationToken, lookupInvitation]);

  return { lookup, lookupError };
}

function useHostedInvitationRedeem(args: {
  invitationToken: string | null | undefined;
  isConvexReady: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  onRedeemed?: (result: { organizationId: string }) => void;
  redeemInvitation: (token: string) => Promise<{ organizationId: string }>;
}) {
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemState, setRedeemState] = useState<"idle" | "redeeming" | "done">(
    "idle"
  );
  const redeemedTokenRef = useRef<string | null>(null);
  const {
    invitationToken,
    isConvexReady,
    isLoaded,
    isSignedIn,
    onRedeemed,
    redeemInvitation,
  } = args;

  useEffect(() => {
    if (!invitationToken || !isLoaded || !isSignedIn || !isConvexReady) {
      return;
    }
    if (
      redeemedTokenRef.current === invitationToken ||
      redeemState === "done"
    ) {
      return;
    }

    redeemedTokenRef.current = invitationToken;
    setRedeemError(null);
    setRedeemState("redeeming");
    void redeemInvitation(invitationToken)
      .then((result) => {
        setRedeemState("done");
        onRedeemed?.({ organizationId: result.organizationId });
      })
      .catch((error: unknown) => {
        redeemedTokenRef.current = null;
        setRedeemState("idle");
        setRedeemError(
          error instanceof Error ? error.message : "Could not accept invitation"
        );
      });
  }, [
    invitationToken,
    isConvexReady,
    isLoaded,
    isSignedIn,
    onRedeemed,
    redeemInvitation,
    redeemState,
  ]);

  return { redeemError, redeemState };
}

function HostedInviteAuthStep(props: {
  copy: {
    signInDescription: string;
    signInTitle: string;
    signUpDescription: string;
    signUpTitle: string;
  };
  email: string;
  mode: "signIn" | "signUp";
  runtime: VortexExpoAuthRuntime;
  setMode: (mode: "signIn" | "signUp") => void;
}) {
  return props.mode === "signUp" ? (
    <HostedSignUpScreen
      copy={{
        description: props.copy.signUpDescription,
        title: props.copy.signUpTitle,
      }}
      initialEmail={props.email}
      onNavigateToSignIn={() => props.setMode("signIn")}
      runtime={props.runtime}
    />
  ) : (
    <HostedSignInScreen
      copy={{
        description: props.copy.signInDescription,
        title: props.copy.signInTitle,
      }}
      initialEmail={props.email}
      onNavigateToSignUp={() => props.setMode("signUp")}
      runtime={props.runtime}
    />
  );
}

function resolveHostedInviteCopy(
  customCopy: HostedInviteRedeemScreenProps["copy"]
) {
  return {
    description: "Accept your invitation and join the workspace.",
    missingTokenDescription: "This invite link is missing its token.",
    missingTokenTitle: "Invite unavailable",
    redeemingDescription: "Your account is ready. Finalizing workspace access.",
    redeemingTitle: "Accepting invitation",
    signInDescription:
      "Already have an account? Sign in to accept this invitation.",
    signInTitle: "Sign in to accept invite",
    signUpDescription:
      "Create your account, then we’ll attach this invitation.",
    signUpTitle: "Accept invite",
    successDescription: "Workspace access granted.",
    successTitle: "Invitation accepted",
    title: "Workspace invite",
    ...customCopy,
  };
}

export function HostedSignInScreen(props: {
  copy?: Partial<HostedCopy>;
  initialEmail?: string;
  onNavigateToSignUp?: () => void;
  runtime: VortexExpoAuthRuntime;
}) {
  const { signInEmail } = props.runtime.useAppAuthActions();
  const copy = {
    description: "Sign in to continue.",
    primaryActionLabel: "Sign in",
    secondaryActionLabel: "Sign up",
    title: "Sign in",
    ...props.copy,
  } satisfies HostedCopy;
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2FA-enabled accounts get `twoFactorRedirect` instead of a completed
  // sign-in. We swap to the step-up form; without this the user would be
  // stranded on this screen with a non-authenticated pending session.
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);

    const result = await signInEmail({ email: email.trim(), password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      return;
    }

    if (
      typeof result.data === "object" &&
      result.data !== null &&
      Reflect.get(result.data, "twoFactorRedirect") === true
    ) {
      setTwoFactorPending(true);
    }
  };

  if (twoFactorPending) {
    return (
      <HostedAuthScaffold>
        {/* On success the session becomes authenticated and the app's
            protected gate navigates away; no explicit redirect needed. */}
        <VortexVerifyTwoFactorForm
          authClient={props.runtime.authClient}
          onVerified={() => undefined}
        />
      </HostedAuthScaffold>
    );
  }

  return (
    <HostedAuthScaffold>
      <View style={styles.stack}>
        <HostedAuthHeader copy={copy} />
        <HostedAuthError error={error} />

        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColorClassName="accent-muted-foreground"
          className="bg-input border-border text-foreground"
          style={styles.input}
          testID="vortex-signin-email"
          value={email}
        />

        <TextInput
          accessibilityLabel="Password"
          autoComplete="password"
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          placeholder="Password"
          placeholderTextColorClassName="accent-muted-foreground"
          returnKeyType="go"
          secureTextEntry={SECURE_TEXT_ENTRY}
          className="bg-input border-border text-foreground"
          style={styles.input}
          testID="vortex-signin-password"
          value={password}
        />

        <TouchableOpacity
          accessibilityLabel={copy.primaryActionLabel}
          accessibilityRole="button"
          disabled={loading || !email.trim() || !password}
          onPress={handleSubmit}
          className="bg-primary"
          style={[
            styles.primaryButton,
            loading || !email.trim() || !password ? styles.disabled : null,
          ]}
          testID="vortex-signin-submit"
        >
          <Text
            className="text-primary-foreground"
            style={styles.primaryButtonText}
          >
            {loading ? "Signing in…" : copy.primaryActionLabel}
          </Text>
        </TouchableOpacity>

        <HostedAuthModeLink
          label="Don’t have an account?"
          onPress={props.onNavigateToSignUp}
          strongLabel={copy.secondaryActionLabel}
          testID="vortex-signin-gotosignup"
        />
      </View>
    </HostedAuthScaffold>
  );
}

export function HostedSignUpScreen(props: {
  copy?: Partial<HostedCopy>;
  initialEmail?: string;
  onNavigateToSignIn?: () => void;
  runtime: VortexExpoAuthRuntime;
}) {
  const { signUpEmail } = props.runtime.useAppAuthActions();
  const copy = {
    description: "Create account to continue.",
    primaryActionLabel: "Sign up",
    secondaryActionLabel: "Sign in",
    title: "Create account",
    ...props.copy,
  } satisfies HostedCopy;
  const [email, setEmail] = useState(props.initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password || !name.trim()) return;
    setLoading(true);
    setError(null);

    const result = await signUpEmail({
      email: email.trim(),
      name: name.trim(),
      password,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message ?? "Sign-up failed");
    }
  };

  return (
    <HostedAuthScaffold>
      <View style={styles.stack}>
        <HostedAuthHeader copy={copy} />
        <HostedAuthError error={error} />

        <TextInput
          accessibilityLabel="Full name"
          autoComplete="name"
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColorClassName="accent-muted-foreground"
          className="bg-input border-border text-foreground"
          style={styles.input}
          testID="vortex-signup-name"
          value={name}
        />

        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColorClassName="accent-muted-foreground"
          className="bg-input border-border text-foreground"
          style={styles.input}
          testID="vortex-signup-email"
          value={email}
        />

        <TextInput
          accessibilityLabel="Password"
          autoComplete="new-password"
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          placeholder="Password"
          placeholderTextColorClassName="accent-muted-foreground"
          returnKeyType="go"
          secureTextEntry={SECURE_TEXT_ENTRY}
          className="bg-input border-border text-foreground"
          style={styles.input}
          testID="vortex-signup-password"
          value={password}
        />

        <TouchableOpacity
          accessibilityLabel={copy.primaryActionLabel}
          accessibilityRole="button"
          disabled={loading || !email.trim() || !password || !name.trim()}
          onPress={handleSubmit}
          className="bg-primary"
          style={[
            styles.primaryButton,
            loading || !email.trim() || !password || !name.trim()
              ? styles.disabled
              : null,
          ]}
          testID="vortex-signup-submit"
        >
          <Text
            className="text-primary-foreground"
            style={styles.primaryButtonText}
          >
            {loading ? "Creating account…" : copy.primaryActionLabel}
          </Text>
        </TouchableOpacity>

        <HostedAuthModeLink
          label="Already have an account?"
          onPress={props.onNavigateToSignIn}
          strongLabel={copy.secondaryActionLabel}
          testID="vortex-signup-gotosignin"
        />
      </View>
    </HostedAuthScaffold>
  );
}

type HostedInviteRedeemScreenProps = {
  copy?: {
    description?: string;
    missingTokenDescription?: string;
    missingTokenTitle?: string;
    redeemingDescription?: string;
    redeemingTitle?: string;
    signInDescription?: string;
    signInTitle?: string;
    signUpDescription?: string;
    signUpTitle?: string;
    successDescription?: string;
    successTitle?: string;
    title?: string;
  };
  invitationToken: string | null | undefined;
  isConvexReady: boolean;
  lookupInvitation: (token: string) => Promise<HostedInvitationLookup | null>;
  onRedeemed?: (result: { organizationId: string }) => void;
  redeemInvitation: (token: string) => Promise<{ organizationId: string }>;
  runtime: VortexExpoAuthRuntime;
};

export function HostedInviteRedeemScreen(props: HostedInviteRedeemScreenProps) {
  const {
    copy: customCopy,
    invitationToken,
    isConvexReady,
    lookupInvitation,
    onRedeemed,
    redeemInvitation,
    runtime,
  } = props;
  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const { isLoaded, isSignedIn } = runtime.useAppAuth();
  const { lookup, lookupError } = useHostedInvitationLookup({
    invitationToken,
    lookupInvitation,
  });
  const { redeemError, redeemState } = useHostedInvitationRedeem({
    invitationToken,
    isConvexReady,
    isLoaded,
    isSignedIn,
    onRedeemed,
    redeemInvitation,
  });
  const copy = resolveHostedInviteCopy(customCopy);

  if (!invitationToken) {
    return (
      <HostedStatusScreen
        label={copy.missingTokenTitle}
        sublabel={copy.missingTokenDescription}
      />
    );
  }

  if (lookup === undefined) {
    return (
      <HostedStatusScreen label={copy.title} sublabel="Loading invitation…" />
    );
  }

  if (lookup === null) {
    return (
      <HostedStatusScreen
        label={copy.missingTokenTitle}
        sublabel={lookupError ?? "Invitation not found or no longer available."}
      />
    );
  }

  if (!isSignedIn) {
    return (
      <HostedInviteAuthStep
        copy={copy}
        email={lookup.email}
        mode={mode}
        runtime={runtime}
        setMode={setMode}
      />
    );
  }

  if (!isConvexReady || redeemState === "redeeming") {
    return (
      <HostedStatusScreen
        label={copy.redeemingTitle}
        sublabel={copy.redeemingDescription}
      />
    );
  }

  if (redeemError) {
    return <HostedStatusScreen label="Invite failed" sublabel={redeemError} />;
  }

  if (redeemState === "done") {
    return (
      <HostedStatusScreen
        label={copy.successTitle}
        sublabel={copy.successDescription}
      />
    );
  }

  return (
    <HostedStatusScreen
      label={copy.redeemingTitle}
      sublabel={copy.redeemingDescription}
    />
  );
}

// Higher-level RN provisioner with web API parity. Web's
// VortexBetterAuthConvexIdentityProvisioner accepts Convex
// FunctionReferences directly; RN's HostedIdentityProvisioningSync
// requires a pre-resolved prop bag. This wrapper closes that gap —
// take the same Convex refs web accepts, manage the runtime + Convex
// hooks internally, and forward the prop bag to the lower-level sync.
//
// Consumer (CRM/pile/Seal) writes the SAME code on web and RN:
//   <BetterAuthConvexIdentityProvisioner
//     runtime={vortexAuth}
//     getCurrentUser={api.auth.getCurrentUser}
//     provisionCurrentUser={api.users.provisionCurrentBetterAuthUser}
//   />
//
// Caught by pile P6 mobile cutover where the consumer had to write
// 12 lines of prop-bag plumbing AND the matching docs comment. Now
// it's the same one-liner as web.
type EmptyArgs = Record<string, never>;

export type BetterAuthConvexIdentityProvisionerProps = {
  runtime: VortexExpoAuthRuntime;
  /**
   * Public Convex query that returns the local users row for the
   * authenticated viewer (null if not signed in yet). Web uses the
   * result to hydrate useAppUser; RN currently only uses isSignedIn
   * but the param is symmetric for forward-compat with #2 (useAppUser
   * shape parity).
   */
  getCurrentUser: FunctionReference<"query", "public", EmptyArgs, unknown>;
  /**
   * Public Convex mutation that ensures the local users row exists
   * for the current Better-Auth identity. Called once per signed-in
   * userId; idempotent.
   */
  provisionCurrentUser: FunctionReference<
    "mutation",
    "public",
    EmptyArgs,
    unknown
  >;
};

export function BetterAuthConvexIdentityProvisioner(
  props: BetterAuthConvexIdentityProvisionerProps
) {
  const auth = props.runtime.useAppAuth();
  const convexAuth = useConvexAuth();
  const provisionMutation = useMutation(props.provisionCurrentUser);
  const provisionCurrentUser = useCallback(
    async () => await provisionMutation({}),
    [provisionMutation]
  );
  // Intentionally reference the query type so a future PR can switch
  // the runtime's useAppUser to hydrate from it (issue #2). Today the
  // param isn't consumed at runtime; keeping it in the signature locks
  // the API symmetry with web's VortexBetterAuthConvexIdentityProvisioner.
  void props.getCurrentUser;

  return (
    <HostedIdentityProvisioningSync
      isConvexReady={!convexAuth.isLoading && convexAuth.isAuthenticated}
      isLoaded={auth.isLoaded}
      isSignedIn={auth.isSignedIn}
      provisionCurrentUser={provisionCurrentUser}
      runtime={props.runtime}
      userId={auth.userId}
    />
  );
}

export function HostedIdentityProvisioningSync(props: {
  isConvexReady: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  provisionCurrentUser: () => Promise<unknown>;
  runtime: VortexExpoAuthRuntime;
  userId: string | null;
}) {
  const sessionRestore = parseVortexExpoSessionRestore(
    props.runtime.authClient.useSession()
  );
  const lastProvisionedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!props.isSignedIn) {
      lastProvisionedUserId.current = null;
      return;
    }
    if (!props.isLoaded || !props.isConvexReady || !props.userId) return;
    if (sessionRestore.kind === "error") return;
    if (lastProvisionedUserId.current === props.userId) return;

    void props
      .provisionCurrentUser()
      .then(() => {
        lastProvisionedUserId.current = props.userId;
      })
      .catch(() => {});
  }, [props, sessionRestore.kind]);

  return null;
}

export function HostedProtectedGate(props: {
  children: ReactNode;
  defaultOrganization: HostedOrganization | null | undefined;
  isConvexReady: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  renderConnecting?: ReactNode;
  renderLoading?: ReactNode;
  renderMissingOrganization: ReactNode;
  renderSignedOut: ReactNode;
}) {
  if (!props.isLoaded) {
    return (
      <>
        {props.renderLoading ?? (
          <HostedStatusScreen label="Restoring session…" />
        )}
      </>
    );
  }
  if (!props.isSignedIn) {
    return <>{props.renderSignedOut}</>;
  }
  if (!props.isConvexReady) {
    return (
      <>
        {props.renderConnecting ?? (
          <HostedStatusScreen
            label="Connecting workspace…"
            sublabel="Auth session is live. Waiting for protected Convex access."
          />
        )}
      </>
    );
  }
  if (props.defaultOrganization === undefined) {
    return (
      <>
        {props.renderLoading ?? (
          <HostedStatusScreen label="Loading organization…" />
        )}
      </>
    );
  }
  if (props.defaultOrganization === null) {
    return <>{props.renderMissingOrganization}</>;
  }
  return <>{props.children}</>;
}

export function HostedOrganizationChooserScreen(props: {
  copy?: {
    createWorkspaceDescription?: string;
    createWorkspaceLabel?: string;
    description?: string;
    emptyTitle?: string;
    title?: string;
  };
  onBootstrap: () => Promise<unknown>;
  onSelect: (organizationId: string) => Promise<unknown>;
  organizations: HostedOrganization[] | undefined;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = {
    createWorkspaceDescription:
      "Bootstrap a default workspace for this account.",
    createWorkspaceLabel: "Create workspace",
    description: "Select your active organization before entering app.",
    emptyTitle: "No workspace yet",
    title: "Choose organization",
    ...props.copy,
  };

  const handleBootstrap = async () => {
    setLoadingId("bootstrap");
    setError(null);
    try {
      await props.onBootstrap();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace"
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleSelect = async (organizationId: string) => {
    setLoadingId(organizationId);
    setError(null);
    try {
      await props.onSelect(organizationId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not switch workspace"
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <ScrollView
      className="bg-background"
      contentContainerStyle={styles.screenContainer}
      style={styles.screenBackground}
    >
      <View style={styles.screenInner}>
        <Text className="text-foreground" style={styles.titleLeft}>
          {copy.title}
        </Text>
        <Text className="text-muted-foreground" style={styles.descriptionLeft}>
          {copy.description}
        </Text>

        {error ? (
          <View
            className="bg-destructive/10 border-destructive/30"
            style={[styles.errorBox, styles.sectionGap]}
          >
            <Text className="text-destructive" style={styles.errorTextLeft}>
              {error}
            </Text>
          </View>
        ) : null}

        {props.organizations === undefined ? (
          <View
            className="bg-card border-border"
            style={[styles.card, styles.sectionGap]}
          >
            <Text className="text-muted-foreground" style={styles.mutedText}>
              Loading organizations…
            </Text>
          </View>
        ) : props.organizations.length === 0 ? (
          <View
            className="bg-card border-border"
            style={[styles.card, styles.sectionGap]}
          >
            <Text className="text-foreground" style={styles.cardTitle}>
              {copy.emptyTitle}
            </Text>
            <Text
              className="text-muted-foreground"
              style={[styles.mutedText, styles.topGap]}
            >
              {copy.createWorkspaceDescription}
            </Text>
            <TouchableOpacity
              disabled={loadingId === "bootstrap"}
              onPress={handleBootstrap}
              className="bg-primary"
              style={[styles.primaryButton, styles.topGapLg]}
            >
              <Text
                className="text-primary-foreground"
                style={styles.primaryButtonText}
              >
                {loadingId === "bootstrap"
                  ? "Creating…"
                  : copy.createWorkspaceLabel}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.stack, styles.sectionGap]}>
            {props.organizations.map((organization) => (
              <TouchableOpacity
                key={organization._id}
                disabled={
                  !organization.canSelect || loadingId === organization._id
                }
                onPress={async () => handleSelect(organization._id)}
                className="bg-card border-border"
                style={styles.card}
              >
                <Text className="text-foreground" style={styles.cardTitle}>
                  {organization.name}
                </Text>
                {organization.roleTemplate ? (
                  <Text
                    className="text-muted-foreground"
                    style={[styles.mutedText, styles.topGapXs]}
                  >
                    {organization.roleTemplate}
                  </Text>
                ) : null}
                {!organization.canSelect ? (
                  <Text
                    className="text-muted-foreground"
                    style={[styles.mutedTextSmall, styles.topGapSm]}
                  >
                    Unavailable
                  </Text>
                ) : loadingId === organization._id ? (
                  <Text
                    className="text-muted-foreground"
                    style={[styles.mutedTextSmall, styles.topGapSm]}
                  >
                    Switching…
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function HostedAuthScaffold(props: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.authContainer}
        keyboardShouldPersistTaps="handled"
      >
        {props.children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HostedStatusScreen(props: { label: string; sublabel?: string }) {
  return (
    <View className="bg-background" style={styles.statusContainer}>
      <Text className="text-foreground" style={styles.statusLabel}>
        {props.label}
      </Text>
      {props.sublabel ? (
        <Text className="text-muted-foreground" style={styles.statusSubLabel}>
          {props.sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
  },
  descriptionLeft: {
    fontSize: 14,
    marginTop: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorTextLeft: {
    fontSize: 14,
  },
  flex: {
    flex: 1,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    height: 48,
    paddingHorizontal: 16,
    width: "100%",
  },
  linkButton: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    textAlign: "center",
  },
  // Color comes from the `text-foreground` className on the element.
  linkTextStrong: {},
  mutedText: {
    fontSize: 14,
  },
  mutedTextSmall: {
    fontSize: 12,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  screenBackground: {
    flex: 1,
  },
  screenContainer: {
    paddingBottom: 32,
  },
  screenInner: {
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  sectionGap: {
    marginTop: 32,
  },
  stack: {
    gap: 16,
  },
  statusContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusSubLabel: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  titleLeft: {
    fontSize: 30,
    fontWeight: "700",
  },
  topGap: {
    marginTop: 8,
  },
  topGapLg: {
    marginTop: 16,
  },
  topGapSm: {
    marginTop: 8,
  },
  topGapXs: {
    marginTop: 4,
  },
});
