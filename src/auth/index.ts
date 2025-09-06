import { db } from '../database/connection';
import { users } from '../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { User, RegisterForm } from '../shared/types';

/**
 * Authentication Service
 * 
 * Handles user authentication, registration, and JWT token management.
 * Provides integration points for Google/iOS SDK authentication.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

export interface AuthResult {
  user: User;
  token: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterForm): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

      // Create user
      const userId = `user_${generateId()}_${Date.now()}`;
      const newUser = {
        id: userId,
        email: data.email,
        name: data.name,
        preferences: {
          notificationSettings: {
            email: true,
            push: true
          },
          summaryFrequency: 'realtime' as const
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(users).values(newUser);

      // Generate JWT token
      const token = this.generateToken(userId);

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          preferences: newUser.preferences,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        },
        token
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Find user by email
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userResult.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userResult[0];

      // For demo purposes, we'll skip password verification
      // In production, you'd verify the hashed password here
      // const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
      // if (!isValidPassword) {
      //   throw new Error('Invalid email or password');
      // }

      // Generate JWT token
      const token = this.generateToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          preferences: user.preferences as any,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token
      };

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (userResult.length === 0) {
        return null;
      }

      const user = userResult[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences as any,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return this.generateToken(decoded.userId);
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Google OAuth authentication (placeholder)
   */
  async authenticateWithGoogle(googleToken: string): Promise<AuthResult> {
    // TODO: Implement Google OAuth verification
    // 1. Verify Google token with Google's API
    // 2. Extract user information
    // 3. Create or update user in database
    // 4. Generate JWT token
    
    throw new Error('Google authentication not yet implemented');
  }

  /**
   * Apple Sign-In authentication (placeholder)
   */
  async authenticateWithApple(appleToken: string): Promise<AuthResult> {
    // TODO: Implement Apple Sign-In verification
    // 1. Verify Apple token
    // 2. Extract user information
    // 3. Create or update user in database
    // 4. Generate JWT token
    
    throw new Error('Apple authentication not yet implemented');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      await db
        .update(users)
        .set({
          name: updates.name,
          avatar: updates.avatar,
          preferences: updates.preferences as any,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      const updatedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (updatedUser.length === 0) {
        throw new Error('User not found');
      }

      const user = updatedUser[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences as any,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      // TODO: Also delete related data (summaries, conversations, etc.)
      await db
        .delete(users)
        .where(eq(users.id, userId));

    } catch (error) {
      console.error('Account deletion error:', error);
      throw error;
    }
  }
}

// Helper function
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const authService = new AuthService();
