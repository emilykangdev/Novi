import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../config/supabase';
import { signUpUser, signInUser, signOutUser } from '../services/supabaseAuth';
import type { User, RegisterForm } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || 'User',
          createdAt: session.user.created_at || new Date().toISOString(),
        };
        setUser(userData);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || 'User',
          createdAt: session.user.created_at || new Date().toISOString(),
        };
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const userData = await signInUser(email, password);
      // User state will be updated by onAuthStateChanged, but we can set it immediately for better UX
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterForm) => {
    try {
      setIsLoading(true);
      const userData = await signUpUser(data);
      // User state will be updated by onAuthStateChanged, but we can set it immediately for better UX
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOutUser();
      // User state will be updated by onAuthStateChanged
      setUser(null);
      setIsAuthenticated(false);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error(error.message || 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
