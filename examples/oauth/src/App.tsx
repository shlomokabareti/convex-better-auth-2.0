import { useAction } from "convex/react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexAuthClientProvider, useAuthActions } from "convex-auth/react";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

function OAuthButtons() {
  const start = useAction(api.auth.signInWithRedirect);

  const handle = async (provider: "google" | "github" | "discord") => {
    const { url } = await start({
      provider,
      callbackURL: `${window.location.origin}/oauth/callback`,
    });
    window.location.href = url;
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => handle("google")}>Google</button>
      <button onClick={() => handle("github")}>GitHub</button>
      <button onClick={() => handle("discord")}>Discord</button>
    </div>
  );
}

function OAuthCallback() {
  const { updateSession } = useAuthActions();

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      void updateSession({ token });
    }
  }

  return <p>Finishing sign-in...</p>;
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthClientProvider actions={api.auth}>
        <OAuthButtons />
        <OAuthCallback />
      </ConvexAuthClientProvider>
    </ConvexProvider>
  );
}
