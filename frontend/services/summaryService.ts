import axios from 'axios';
import type { Summary, ApiResponse, PaginatedResponse } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3500';

class SummaryService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async getRecentSummaries(limit: number = 20): Promise<ApiResponse<Summary[]>> {
    try {
      const response = await this.apiClient.get(`/summaries/recent?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Get recent summaries error:', error);
      return {
        success: false,
        error: 'Failed to fetch recent summaries',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async searchSummaries(query: string, limit: number = 20): Promise<ApiResponse<Summary[]>> {
    try {
      const response = await this.apiClient.get(`/summaries/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Search summaries error:', error);
      return {
        success: false,
        error: 'Failed to search summaries',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSummariesByType(type: string, limit: number = 20): Promise<ApiResponse<Summary[]>> {
    try {
      const response = await this.apiClient.get(`/summaries/type/${type}?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Get summaries by type error:', error);
      return {
        success: false,
        error: `Failed to fetch ${type} summaries`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSummary(id: string): Promise<ApiResponse<Summary>> {
    try {
      const response = await this.apiClient.get(`/summaries/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get summary error:', error);
      return {
        success: false,
        error: 'Failed to fetch summary',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Set auth token for authenticated requests
  setAuthToken(token: string) {
    this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Clear auth token
  clearAuthToken() {
    delete this.apiClient.defaults.headers.common['Authorization'];
  }
}

export const summaryService = new SummaryService();
