# React Native / Expo

`convex-auth-react-native` is the Expo / React Native client. It mirrors `convex-auth-react` but uses React Native compatible storage and screen components.

## Install

```bash
pnpm add convex-auth-react-native convex-auth convex
```

## Configure the provider

```tsx
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexAuthClientProvider } from "convex-auth-react-native";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

function App() {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthClientProvider actions={api.auth}>
        <App />
      </ConvexAuthClientProvider>
    </ConvexProvider>
  );
}
```

## Storage

React Native uses `SecureStore` for the token and refresh token. `convex-auth-react-native` sets this up by default.

## Sign-in form

```tsx
import { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { useAuthActions } from "convex-auth-react-native";

export function SignIn() {
  const { signIn, isLoading } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <Button title="Sign in" disabled={isLoading} onPress={() => signIn({ email, password })} />
    </View>
  );
}
```

## See also

- `examples/react-native` for a minimal Expo app.
- `docs/examples.md` for all runnable examples.
