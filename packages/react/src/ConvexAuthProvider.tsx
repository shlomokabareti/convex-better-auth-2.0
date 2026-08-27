import { useAction } from "convex/react";
import type { FunctionReference } from "convex/server";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NativeAuthSignUpArgs = {
  email: string;
  password: string;
  name?: string;
};

export type NativeAuthSignInArgs = {
  email: string;
  password: string;
};

export type NativeAuthSignOutArgs = {
  token: string;
};

export type NativeAuthSession = {
  token: string;
  userId: string;
  identityId: string;
  sessionId: string;
};

export type NativeAuthActions = {
  signUp: FunctionReference<
    "action",
    "public",
    NativeAuthSignUpArgs,
    NativeAuthSession
  >;
  signIn: FunctionReference<
    "action",
    "public",
    NativeAuthSignInArgs,
    NativeAuthSession
  >;
  signOut: FunctionReference<
    "action",
    "public",
    NativeAuthSignOutArgs,
    { success: boolean }
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
  const [token, setToken] = useState<string | null>(null);
  const value = useMemo(
    () => ({ ...props.actions, token, setToken }),
    [props.actions, token],
  );
  return (
    <ConvexAuthContext.Provider value={value}>
      {props.children}
    </ConvexAuthContext.Provider>
  );
}

export function useAuthActions() {
  const ctx = useContext(ConvexAuthContext);
  if (ctx === null) {
    throw new Error(
      "useAuthActions must be used within a ConvexAuthProvider",
    );
  }

  const signUpAction = useAction(ctx.signUp);
  const signInAction = useAction(ctx.signIn);
  const signOutAction = useAction(ctx.signOut);

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

  return {
    signUp,
    signIn,
    signOut,
    token: ctx.token,
    isLoading,
    isAuthenticated: ctx.token !== null,
  };
}
