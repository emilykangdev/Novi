import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, Card, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo';
import { theme } from '../../theme/theme';

export default function RegisterScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const handleRegister = async () => {
    if (!isLoaded) return;

    setLoading(true);
    try {
      // Create the user account (no verification needed)
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      // If account creation is complete, sign in immediately
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.errors?.[0]?.message || err.message || 'Registration failed';
      Alert.alert('Registration Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // COMMENTED OUT: Email verification flow (disabled in Clerk dashboard)
  /*
  if (verifying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Verify Your Email</Title>
              <Text style={styles.subtitle}>
                We sent a verification code to {email}
              </Text>

              <TextInput
                label="Verification Code"
                value={code}
                onChangeText={setCode}
                mode="outlined"
                style={styles.input}
                keyboardType="number-pad"
                autoCapitalize="none"
                placeholder="Enter 6-digit code"
              />

              <Button
                mode="contained"
                onPress={handleVerify}
                loading={loading}
                disabled={!code || loading}
                style={styles.button}
              >
                Verify Email
              </Button>

              <Button
                mode="text"
                onPress={() => setVerifying(false)}
                style={styles.linkButton}
              >
                Back to registration
              </Button>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    );
  }
  */

  // Display initial registration form
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Create Account</Title>
            <Text style={styles.subtitle}>Sign up to get started</Text>

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

            {/* Clerk CAPTCHA widget */}
            {/* <View style={styles.captchaContainer}>
              <div id="clerk-captcha" />
            </View> */}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={!email || !password || !name || loading}
              style={styles.button}
            >
              Sign Up
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