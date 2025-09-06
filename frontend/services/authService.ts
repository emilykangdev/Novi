import axios from 'axios';
import type { User, ApiResponse, RegisterForm } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3500';

interface LoginResponse {
  user: User;
  token: string;
}

interface RegisterResponse {
  user: User;
  token: string;
}

class AuthService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await this.apiClient.post('/auth/login', {
        email,
        password,
      });

      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || 'Network error occurred',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async register(data: RegisterForm): Promise<ApiResponse<RegisterResponse>> {
    try {
      const response = await this.apiClient.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
      });

      return response.data;
    } catch (error) {
      console.error('Register API error:', error);
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          error: error.response?.data?.error || 'Network error occurred',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const response = await this.apiClient.get('/auth/validate', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        return response.data.data.user;
      }

      return null;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Don't throw error for logout - local cleanup is more important
    }
  }

  async refreshToken(token: string): Promise<string | null> {
    try {
      const response = await this.apiClient.post('/auth/refresh', {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        return response.data.data.token;
      }

      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  // Set auth token for subsequent requests
  setAuthToken(token: string) {
    this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Clear auth token
  clearAuthToken() {
    delete this.apiClient.defaults.headers.common['Authorization'];
  }
}

export const authService = new AuthService();
