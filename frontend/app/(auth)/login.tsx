import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, Card, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { theme } from '../../theme/theme';

/**
 * Login screen component that authenticates users via Clerk using email/password or Google OAuth.
 *
 * Renders inputs for email and password, a "Sign In with Email" button, a "Continue with Google" OAuth button,
 * and a link to the registration screen. Uses Clerk's signIn and OAuth flows; on successful authentication
 * it activates the created session and navigates to '/(tabs)'. Displays an alert for authentication errors
 * and manages a local loading state while requests are in progress.
 *
 * @returns The React element for the login screen.
 */
export default function LoginScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!isLoaded) return;

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');
      const { createdSessionId, setActive: setActiveFromOAuth } = await startOAuthFlow({ redirectUrl });
      if (createdSessionId) {
        await setActiveFromOAuth({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Welcome Back</Title>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <Button
              mode="contained"
              onPress={handleGoogleLogin}
              loading={loading}
              style={styles.button}
            >
              Continue with Google
            </Button>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
              secureTextEntry
            />

            <Button
              mode="outlined"
              onPress={handleLogin}
              loading={loading}
              disabled={!email || !password || loading}
              style={styles.button}
            >
              Sign In with Email
            </Button>

            <Button
              mode="text"
              onPress={() => router.push('/(auth)/register')}
              style={styles.linkButton}
            >
              Don't have an account? Sign up
            </Button>
          </Card.Content>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: theme.colors.onSurface,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  linkButton: {
    marginTop: 8,
  },
});
