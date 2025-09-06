import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, Card, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import { theme } from '../../theme/theme';

/**
 * Registration screen component that lets users sign up with email/password or Google OAuth.
 *
 * Renders a form (name, email, password), a "Continue with Google" button, and navigation to the login screen.
 * - Email sign-up uses Clerk's signUp.create and, on success, activates the session and replaces the router to '/(tabs)'.
 * - Google sign-up starts an OAuth flow (strategy 'oauth_google') with a redirect URL (built via Linking.createURL('/')), activates the returned session on success, and replaces the router to '/(tabs)'.
 * - Errors from either flow are surfaced via Alert dialogs. Local loading state prevents duplicate submissions and disables the email sign-up button when inputs are missing.
 *
 * @returns A React element for the registration screen.
 */
export default function RegisterScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!isLoaded) return;

    setLoading(true);
    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName: name,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
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
            <Title style={styles.title}>Create Account</Title>
            <Text style={styles.subtitle}>Sign up to get started</Text>

            <Button
              mode="contained"
              onPress={handleGoogleRegister}
              loading={loading}
              style={styles.button}
            >
              Continue with Google
            </Button>

            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              autoCapitalize="words"
            />

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
              onPress={handleRegister}
              loading={loading}
              disabled={!email || !password || !name || loading}
              style={styles.button}
            >
              Sign Up with Email
            </Button>

            <Button
              mode="text"
              onPress={() => router.push('/(auth)/login')}
              style={styles.linkButton}
            >
              Already have an account? Sign in
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
  captchaContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
});
