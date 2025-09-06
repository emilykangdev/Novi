import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { router } from 'expo-router';

import { useAuth } from '../../contexts/AuthContext';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Profile
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Welcome, {user?.name || 'User'}!
      </Text>
      <Text style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>
        {user?.email}
      </Text>
      
      <Button 
        mode="outlined" 
        onPress={handleLogout}
        style={styles.button}
      >
        Logout
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
    marginBottom: 30,
  },
  button: {
    marginTop: 20,
  },
});
