import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph } from 'react-native-paper';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { Link, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';

export default function IndexScreen() {
  const { user } = useUser();

  return (
    <SafeAreaView style={styles.container}>
      <SignedIn>
        {/* User is authenticated - redirect to tabs */}
        <Redirect href="/(tabs)" />
      </SignedIn>
      
      <SignedOut>
        {/* User is not authenticated - show welcome screen */}
        <View style={styles.welcomeContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Welcome to Novi</Title>
              <Paragraph style={styles.subtitle}>
                Your Friendly Info Companion
              </Paragraph>
              
              <View style={styles.buttonContainer}>
                <Link href="/(auth)/login" asChild>
                  <Button mode="contained" style={styles.button}>
                    Sign In
                  </Button>
                </Link>
                
                <Link href="/(auth)/register" asChild>
                  <Button mode="outlined" style={styles.button}>
                    Create Account
                  </Button>
                </Link>
              </View>
            </Card.Content>
          </Card>
        </View>
      </SignedOut>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  welcomeContainer: {
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
  buttonContainer: {
    gap: 12,
  },
  button: {
    marginVertical: 4,
  },
});
