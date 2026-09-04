import { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { useAuthActions } from "convex-auth/react-native";

function SignIn() {
  const { signIn, signUp, signOut, isLoading, isAuthenticated } = useAuthActions();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isAuthenticated) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Signed in.</Text>
        <Button title="Sign out" onPress={() => signOut({})} />
      </View>
    );
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput value={name} onChangeText={setName} placeholder="Name" autoCapitalize="none" />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />
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

export default function App() {
  return <SignIn />;
}
