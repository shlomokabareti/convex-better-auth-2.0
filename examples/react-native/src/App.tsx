import { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexAuthClientProvider, useAuthActions } from "convex-auth-react-native";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

function SignIn() {
  const { signIn, signUp, isLoading, isAuthenticated } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated) {
    return <Text>Signed in.</Text>;
  }

  return (
    <View style={{ padding: 24 }}>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
      />
      <Button title="Sign in" disabled={isLoading} onPress={() => signIn({ email, password })} />
      <Button title="Sign up" disabled={isLoading} onPress={() => signUp({ email, password })} />
    </View>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <ConvexAuthClientProvider actions={api.auth}>
        <SignIn />
      </ConvexAuthClientProvider>
    </ConvexProvider>
  );
}
