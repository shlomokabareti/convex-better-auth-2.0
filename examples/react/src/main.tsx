import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexAuthClientProvider, type NativeAuthActions } from "convex-auth/react";
import { api } from "../convex/_generated/api";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ConvexAuthClientProvider actions={api.auth as unknown as NativeAuthActions}>
        <App />
      </ConvexAuthClientProvider>
    </ConvexProvider>
  </StrictMode>,
);
