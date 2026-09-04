# React Native / Expo

`convex-auth-react-native` is the Expo / React Native client. It mirrors `convex-auth-react` but uses React Native compatible storage and screen components.

## Install

```bash
pnpm add convex-auth-react-native convex-auth convex
```

## Configure the provider

```tsx
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ExpoConvexAuthProvider } from "convex-auth/react-native";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

function App() {
  return (
    <ConvexProvider client={convex}>
      <ExpoConvexAuthProvider actions={api.auth} storage={storage}>
        <App />
      </ExpoConvexAuthProvider>
    </ConvexProvider>
  );
}
```

## Storage

React Native uses `expo-secure-store` (or an equivalent storage backend) for the token and refresh token. `ExpoConvexAuthProvider` accepts any sync `getItem`/`setItem` storage.

## Sign-in form

```tsx
import { useState } from "react";
import { View, TextInput, Button } from "react-native";
import { useAuthActions } from "convex-auth/react-native";

export function SignIn() {
  const { signIn, signUp, isLoading } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View>
      <TextInput value={name} onChangeText={setName} placeholder="Name" />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <Button title="Sign in" disabled={isLoading} onPress={() => signIn({ email, password })} />
      <Button
        title="Sign up"
        disabled={isLoading}
        onPress={() => signUp({ name, email, password })}
      />
    </View>
  );
}
```

## See also

- `examples/react-native` for a runnable `react-native-web` + Vite app.
- `docs/examples.md` for all runnable examples.
