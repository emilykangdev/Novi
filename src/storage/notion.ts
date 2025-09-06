import { Client } from '@notionhq/client';
import type { StorageProvider, StorageOptions } from './index';
import type { Summary, StorageLocation } from '../shared/types';
import { getToolsForAgent, isComposioEnabled } from '../integrations/composio';
import { upsertStorageLocationSB, isSupabaseEnabled } from '../database/supabase';

/**
 * Notion Storage Provider
 * 
 * Stores summaries as Notion pages in a specified database.
 * Supports rich formatting and metadata.
 */

export class NotionStorage implements StorageProvider {
  public readonly name = 'notion';
  private client: Client | null = null;
  private databaseId: string | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (apiKey && databaseId) {
      this.client = new Client({ auth: apiKey });
      this.databaseId = databaseId;
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.databaseId !== null;
  }

  async createDocument(summary: Summary, options?: StorageOptions): Promise<StorageLocation> {
    if (!this.client || !this.databaseId) {
      throw new Error('Notion client not configured');
    }

    try {
      const useComposio = isComposioEnabled();

      if (useComposio) {
        try {
          const tools = await getToolsForAgent(summary.userId as unknown as string, 'interaction-agent');
          const createTool: any = tools.find((t: any) => typeof t?.name === 'string' && /notion/i.test(t.name) && /create|page/i.test(t.name));
          if (createTool && typeof createTool.execute === 'function') {
            const title = options?.title || summary.summary.substring(0, 100) + '...';
            const res: any = await createTool.execute({ title, content: summary.summary, properties: { sentiment: summary.sentiment, topics: summary.topics, confidence: summary.confidence } });
            const storageLocation: StorageLocation = {
              id: `notion_${res?.id || generateId()}_${Date.now()}`,
              summaryId: summary.id,
              provider: 'notion',
              externalId: res?.id || 'unknown',
              url: res?.url,
              metadata: { pageTitle: title },
              createdAt: new Date()
            };
            if (isSupabaseEnabled()) await upsertStorageLocationSB({ id: storageLocation.id, summary_id: summary.id, provider: 'notion', external_id: storageLocation.externalId, url: storageLocation.url || null, metadata: storageLocation.metadata, created_at: storageLocation.createdAt.toISOString() });
            return storageLocation;
          }
        } catch (e) {
          console.error('[Notion Storage] Composio create failed, falling back:', e);
        }
      }

      // Fallback: direct Notion SDK
      const pageContent = this.formatSummaryContent(summary);
      const response = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          'Title': { title: [{ text: { content: options?.title || summary.summary.substring(0, 100) + '...' } }] },
          'Type': { select: { name: this.getContentType(summary) } },
          'Sentiment': { select: { name: summary.sentiment || 'neutral' } },
          'Topics': { multi_select: (summary.topics || []).map(topic => ({ name: topic })) },
          'Confidence': { number: summary.confidence || 0 },
          'Created': { date: { start: summary.createdAt.toISOString() } }
        },
        children: pageContent
      });

      const storageLocation: StorageLocation = {
        id: `notion_${response.id}_${Date.now()}`,
        summaryId: summary.id,
        provider: 'notion',
        externalId: response.id,
        url: (response as any).url,
        metadata: { pageTitle: options?.title || summary.summary.substring(0, 100) + '...', parentId: this.databaseId },
        createdAt: new Date()
      };
      if (isSupabaseEnabled()) await upsertStorageLocationSB({ id: storageLocation.id, summary_id: summary.id, provider: 'notion', external_id: storageLocation.externalId, url: storageLocation.url || null, metadata: storageLocation.metadata, created_at: storageLocation.createdAt.toISOString() });
      console.log(`[Notion Storage] Created page: ${(response as any).url}`);
      return storageLocation;

    } catch (error) {
      console.error('[Notion Storage] Create document error:', error);
      throw new Error(`Failed to create Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateDocument(storageLocation: StorageLocation, summary: Summary): Promise<void> {
    if (!this.client) {
      throw new Error('Notion client not configured');
    }

    try {
      // Update page properties
      await this.client.pages.update({
        page_id: storageLocation.externalId,
        properties: {
          'Sentiment': {
            select: {
              name: summary.sentiment || 'neutral'
            }
          },
          'Topics': {
            multi_select: (summary.topics || []).map(topic => ({ name: topic }))
          },
          'Confidence': {
            number: summary.confidence || 0
          }
        }
      });

      // TODO: Update page content if needed
      console.log(`[Notion Storage] Updated page: ${storageLocation.externalId}`);

    } catch (error) {
      console.error('[Notion Storage] Update document error:', error);
      throw new Error(`Failed to update Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDocument(storageLocation: StorageLocation): Promise<void> {
    if (!this.client) {
      throw new Error('Notion client not configured');
    }

    try {
      // Archive the page (Notion doesn't support permanent deletion via API)
      await this.client.pages.update({
        page_id: storageLocation.externalId,
        archived: true
      });

      console.log(`[Notion Storage] Archived page: ${storageLocation.externalId}`);

    } catch (error) {
      console.error('[Notion Storage] Delete document error:', error);
      throw new Error(`Failed to archive Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDocument(storageLocation: StorageLocation): Promise<any> {
    if (!this.client) {
      throw new Error('Notion client not configured');
    }

    try {
      const page = await this.client.pages.retrieve({
        page_id: storageLocation.externalId
      });

      return page;

    } catch (error) {
      console.error('[Notion Storage] Get document error:', error);
      throw new Error(`Failed to get Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatSummaryContent(summary: Summary): any[] {
    const content: any[] = [];

    // Add summary section
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '📝 Summary'
            }
          }
        ]
      }
    });

    content.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: summary.summary
            }
          }
        ]
      }
    });

    // Add key points section
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      content.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: '🔑 Key Points'
              }
            }
          ]
        }
      });

      summary.keyPoints.forEach(point => {
        content.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: point
                }
              }
            ]
          }
        });
      });
    }

    // Add metadata section
    content.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: '📊 Metadata'
            }
          }
        ]
      }
    });

    const metadata = [
      `**AI Model:** ${summary.aiModel || 'Unknown'}`,
      `**Confidence:** ${summary.confidence || 0}%`,
      `**Sentiment:** ${summary.sentiment || 'neutral'}`,
      `**Topics:** ${summary.topics?.join(', ') || 'None'}`,
      `**Created:** ${summary.createdAt.toLocaleDateString()}`
    ];

    content.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: metadata.join('\n')
            }
          }
        ]
      }
    });

    return content;
  }

  private getContentType(summary: Summary): string {
    return 'Content';
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
