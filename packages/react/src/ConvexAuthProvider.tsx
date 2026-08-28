import { useAction, useConvex } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NativeAuthSignUpArgs = {
  email: string;
  password: string;
  name: string;
};

export type NativeAuthSignInArgs = {
  email: string;
  password: string;
};

export type NativeAuthSignOutArgs = {
  token: string;
};

export type NativeAuthUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
};

export type NativeAuthSession = {
  token: string;
  user: NativeAuthUser;
  userId: string;
  identityId: string;
  sessionId: string;
};

export type NativeAuthSendResult = {
  status: "queued" | "not_configured" | "failed";
  reason?: string;
  emailId?: string;
};

export type NativeAuthVerifyResult = {
  success: boolean;
  reason?: string;
};

export type NativeAuthResetResult =
  | {
      success: true;
      token: string;
      userId: string;
      identityId: string;
      sessionId: string;
    }
  | { success: false; reason?: string };

export type NativeAuthActions = {
  signUp: FunctionReference<"action", "public", NativeAuthSignUpArgs, NativeAuthSession>;
  signIn: FunctionReference<"action", "public", NativeAuthSignInArgs, NativeAuthSession>;
  signOut: FunctionReference<"action", "public", NativeAuthSignOutArgs, { success: boolean }>;
  sendEmailVerification: FunctionReference<
    "action",
    "public",
    { email: string },
    NativeAuthSendResult
  >;
  verifyEmail: FunctionReference<"action", "public", { token: string }, NativeAuthVerifyResult>;
  sendPasswordReset: FunctionReference<"action", "public", { email: string }, NativeAuthSendResult>;
  resetPassword: FunctionReference<
    "action",
    "public",
    { token: string; newPassword: string },
    NativeAuthResetResult
  >;
};

type ConvexAuthContextValue = NativeAuthActions & {
  token: string | null;
  setToken: (token: string | null) => void;
};

const ConvexAuthContext = createContext<ConvexAuthContextValue | null>(null);

export type ConvexAuthProviderProps = {
  actions: NativeAuthActions;
  children: ReactNode;
};

export function ConvexAuthProvider(props: ConvexAuthProviderProps) {
  const client = useConvex();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    client.setAuth(() => Promise.resolve(token));
  }, [client, token]);

  useEffect(() => {
    return () => {
      client.clearAuth();
    };
  }, [client]);

  const value = useMemo(() => ({ ...props.actions, token, setToken }), [props.actions, token]);
  return <ConvexAuthContext.Provider value={value}>{props.children}</ConvexAuthContext.Provider>;
}

export function useAuthActions() {
  const ctx = useContext(ConvexAuthContext);
  if (ctx === null) {
    throw new Error("useAuthActions must be used within a ConvexAuthProvider");
  }

  const signUpAction = useAction(ctx.signUp);
  const signInAction = useAction(ctx.signIn);
  const signOutAction = useAction(ctx.signOut);
  const sendEmailVerificationAction = useAction(ctx.sendEmailVerification);
  const verifyEmailAction = useAction(ctx.verifyEmail);
  const sendPasswordResetAction = useAction(ctx.sendPasswordReset);
  const resetPasswordAction = useAction(ctx.resetPassword);

  const [isLoading, setIsLoading] = useState(false);

  const signUp = useCallback(
    async (args: NativeAuthSignUpArgs) => {
      setIsLoading(true);
      try {
        const session = await signUpAction(args);
        ctx.setToken(session.token);
        return session;
      } finally {
        setIsLoading(false);
      }
    },
    [signUpAction, ctx],
  );

  const signIn = useCallback(
    async (args: NativeAuthSignInArgs) => {
      setIsLoading(true);
      try {
        const session = await signInAction(args);
        ctx.setToken(session.token);
        return session;
      } finally {
        setIsLoading(false);
      }
    },
    [signInAction, ctx],
  );

  const signOut = useCallback(async () => {
    if (ctx.token === null) {
      return { success: true as const };
    }
    setIsLoading(true);
    try {
      const result = await signOutAction({ token: ctx.token });
      ctx.setToken(null);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [signOutAction, ctx]);

  const sendEmailVerification = useCallback(
    async (email: string) => {
      setIsLoading(true);
      try {
        return await sendEmailVerificationAction({ email });
      } finally {
        setIsLoading(false);
      }
    },
    [sendEmailVerificationAction],
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      setIsLoading(true);
      try {
        return await verifyEmailAction({ token });
      } finally {
        setIsLoading(false);
      }
    },
    [verifyEmailAction],
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      setIsLoading(true);
      try {
        return await sendPasswordResetAction({ email });
      } finally {
        setIsLoading(false);
      }
    },
    [sendPasswordResetAction],
  );

  const resetPassword = useCallback(
    async (args: { token: string; newPassword: string }) => {
      setIsLoading(true);
      try {
        const result = await resetPasswordAction(args);
        if ("token" in result) {
          ctx.setToken(result.token);
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [resetPasswordAction, ctx],
  );

  return {
    signUp,
    signIn,
    signOut,
    sendEmailVerification,
    verifyEmail,
    sendPasswordReset,
    resetPassword,
    token: ctx.token,
    isLoading,
    isAuthenticated: ctx.token !== null,
  };
}
