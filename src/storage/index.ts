import { NotionStorage } from './notion';
import { GoogleDocsStorage } from './google-docs';
import type { Summary, StorageLocation, StorageMetadata } from '../shared/types';

/**
 * Storage Integration Manager
 * 
 * Provides a unified interface for storing summaries across different platforms.
 * Supports Notion and Google Docs with flexible provider switching.
 */

export interface StorageProvider {
  name: string;
  createDocument(summary: Summary, options?: StorageOptions): Promise<StorageLocation>;
  updateDocument(storageLocation: StorageLocation, summary: Summary): Promise<void>;
  deleteDocument(storageLocation: StorageLocation): Promise<void>;
  getDocument(storageLocation: StorageLocation): Promise<any>;
  isConfigured(): boolean;
}

export interface StorageOptions {
  title?: string;
  parentId?: string;
  template?: string;
  tags?: string[];
  permissions?: Array<{
    type: string;
    role: string;
    emailAddress?: string;
  }>;
}

export class StorageManager {
  private providers: Map<string, StorageProvider> = new Map();

  constructor() {
    // Initialize storage providers
    this.providers.set('notion', new NotionStorage());
    this.providers.set('google_docs', new GoogleDocsStorage());
  }

  /**
   * Get available storage providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter(name => 
      this.providers.get(name)?.isConfigured() || false
    );
  }

  /**
   * Store a summary using the specified provider
   */
  async storeSummary(
    provider: string, 
    summary: Summary, 
    options?: StorageOptions
  ): Promise<StorageLocation> {
    const storageProvider = this.providers.get(provider);
    
    if (!storageProvider) {
      throw new Error(`Storage provider '${provider}' not found`);
    }

    if (!storageProvider.isConfigured()) {
      throw new Error(`Storage provider '${provider}' is not configured`);
    }

    return await storageProvider.createDocument(summary, options);
  }

  /**
   * Store a summary using multiple providers
   */
  async storeSummaryMultiple(
    providers: string[], 
    summary: Summary, 
    options?: StorageOptions
  ): Promise<StorageLocation[]> {
    const results: StorageLocation[] = [];
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const location = await this.storeSummary(provider, summary, options);
        results.push(location);
      } catch (error) {
        console.error(`Failed to store in ${provider}:`, error);
        errors.push(`${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (results.length === 0) {
      throw new Error(`Failed to store in any provider. Errors: ${errors.join(', ')}`);
    }

    return results;
  }

  /**
   * Update a stored summary
   */
  async updateStoredSummary(
    storageLocation: StorageLocation, 
    summary: Summary
  ): Promise<void> {
    const provider = this.providers.get(storageLocation.provider);
    
    if (!provider) {
      throw new Error(`Storage provider '${storageLocation.provider}' not found`);
    }

    await provider.updateDocument(storageLocation, summary);
  }

  /**
   * Delete a stored summary
   */
  async deleteStoredSummary(storageLocation: StorageLocation): Promise<void> {
    const provider = this.providers.get(storageLocation.provider);
    
    if (!provider) {
      throw new Error(`Storage provider '${storageLocation.provider}' not found`);
    }

    await provider.deleteDocument(storageLocation);
  }

  /**
   * Get a stored summary
   */
  async getStoredSummary(storageLocation: StorageLocation): Promise<any> {
    const provider = this.providers.get(storageLocation.provider);
    
    if (!provider) {
      throw new Error(`Storage provider '${storageLocation.provider}' not found`);
    }

    return await provider.getDocument(storageLocation);
  }

  /**
   * Test storage provider configuration
   */
  async testProvider(provider: string): Promise<boolean> {
    const storageProvider = this.providers.get(provider);
    
    if (!storageProvider) {
      return false;
    }

    return storageProvider.isConfigured();
  }
}

// Export storage providers
export { NotionStorage } from './notion';
export { GoogleDocsStorage } from './google-docs';

// Create singleton instance
export const storageManager = new StorageManager();
