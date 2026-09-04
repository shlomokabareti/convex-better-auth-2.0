import { useState } from "react";
import { useAuthActions } from "convex-auth/react";

export default function App() {
  const { signIn, signUp, signOut, isLoading, isAuthenticated } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 360, margin: "40px auto" }}>
      <h1>convex-auth example</h1>

      {isAuthenticated ? (
        <>
          <p>Already signed in.</p>
          <button onClick={() => signOut()} disabled={isLoading}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <button
            onClick={async () => {
              await signUp({ name, email, password });
            }}
            disabled={isLoading}
            style={{ marginRight: 8 }}
          >
            Sign up
          </button>
          <button
            onClick={async () => {
              await signIn({ email, password });
            }}
            disabled={isLoading}
          >
            Sign in
          </button>
        </>
      )}
    </main>
  );
}
