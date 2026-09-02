import { useAuthActions } from "./ConvexAuthProvider";
import type { ConvexBetterAuthClient } from "./better-auth-runtime";

function toError(err: unknown): { message: string } {
  return { message: err instanceof Error ? err.message : "Unknown error" };
}

/**
 * Builds a `ConvexBetterAuthClient`-shaped object over the native
 * `ConvexAuthProvider`/`useAuthActions` runtime. Existing forms and hooks
 * that expect a `ConvexBetterAuthClient` prop can receive this value
 * without changing their call sites.
 *
 * This is the bridge layer: it preserves the public method shape while
 * the implementation is now pure Convex actions.
 */
export function useConvexAuthClient() {
  const actions = useAuthActions();

  const session = {
    data:
      actions.user === null
        ? null
        : {
            session: {
              id: actions.sessionId ?? "",
              token: actions.token,
            },
            user: {
              id: actions.user.id,
              email: actions.user.email ?? "",
              emailVerified: actions.user.emailVerified,
              image: actions.user.image ?? null,
              name: actions.user.name ?? null,
            },
          },
    error: null,
    isPending: actions.isLoading,
    isRefetching: false,
  };

  return {
    useSession: () => session,

    signOut: async () => {
      await actions.signOut();
    },

    signIn: {
      email: async (args) => {
        try {
          const data = await actions.signIn({ ...args, rememberMe: false });
          return { data, error: null };
        } catch (err) {
          return { data: null, error: toError(err) };
        }
      },
      social: async (args) => {
        try {
          const result = await actions.signInWithRedirect(args);
          return {
            data: { ...result, redirect: true },
            error: null,
          };
        } catch (err) {
          return { data: null, error: toError(err) };
        }
      },
    },

    signUp: {
      email: async (args) => {
        try {
          const data = await actions.signUp({ ...args, rememberMe: false });
          return { data, error: null };
        } catch (err) {
          return { data: null, error: toError(err) };
        }
      },
    },

    convex: {
      token: async () => ({
        data: { token: actions.token ?? null },
      }),
    },

    forgetPassword: async (args) => {
      try {
        await actions.sendPasswordReset({
          email: args.email,
          redirectTo: args.redirectTo,
        });
        return { data: { status: true }, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    resetPassword: async (args) => {
      try {
        const result = await actions.resetPassword({
          token: args.token,
          newPassword: args.newPassword,
        });
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    sendVerificationEmail: async (args) => {
      try {
        const result = await actions.sendEmailVerification({
          email: args.email,
          callbackURL: args.callbackURL,
        });
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    verifyEmail: async (args) => {
      try {
        const result = await actions.verifyEmail(args.query.token);
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },

    changeEmail: async (args) => {
      try {
        const result = await actions.changeEmail({
          newEmail: args.newEmail,
          callbackURL: args.callbackURL,
        });
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: toError(err) };
      }
    },
  } satisfies ConvexBetterAuthClient;
}
