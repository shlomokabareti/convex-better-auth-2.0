import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

const signInWithRedirect = api.auth.signInWithRedirect;
if (signInWithRedirect === undefined) {
  throw new Error("OAuth is not configured in convex/auth.ts");
}

function OAuthButtons() {
  const start = useAction(signInWithRedirect);

  const startOAuth = async (provider: "google" | "github" | "discord") => {
    const { url } = await start({
      provider,
      callbackURL: window.location.origin,
      errorURL: `${window.location.origin}/auth/error`,
    });
    window.location.href = url;
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => startOAuth("google")}>Google</button>
      <button onClick={() => startOAuth("github")}>GitHub</button>
      <button onClick={() => startOAuth("discord")}>Discord</button>
    </div>
  );
}

export default function App() {
  return <OAuthButtons />;
}
