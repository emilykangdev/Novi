import { google } from 'googleapis';
import type { StorageProvider, StorageOptions } from './index';
import type { Summary, StorageLocation } from '../shared/types';
import { getToolsForAgent, isComposioEnabled } from '../integrations/composio';
import { isSupabaseEnabled, upsertStorageLocationSB } from '../database/supabase';

/**
 * Google Docs Storage Provider
 * 
 * Stores summaries as Google Docs documents.
 * Supports rich formatting and sharing permissions.
 */

export class GoogleDocsStorage implements StorageProvider {
  public readonly name = 'google_docs';
  private docs: any = null;
  private drive: any = null;
  private auth: any = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const clientId = process.env.GOOGLE_DOCS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DOCS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DOCS_REFRESH_TOKEN;

    if (clientId && clientSecret && refreshToken) {
      this.auth = new google.auth.OAuth2(clientId, clientSecret);
      this.auth.setCredentials({ refresh_token: refreshToken });
      
      this.docs = google.docs({ version: 'v1', auth: this.auth });
      this.drive = google.drive({ version: 'v3', auth: this.auth });
    }
  }

  isConfigured(): boolean {
    return this.docs !== null && this.drive !== null && this.auth !== null;
  }

  async createDocument(summary: Summary, options?: StorageOptions): Promise<StorageLocation> {
    if (!this.docs || !this.drive) {
      throw new Error('Google Docs client not configured');
    }

    try {
      const useComposio = isComposioEnabled();
      const title = options?.title || `Summary - ${summary.summary.substring(0, 50)}...`;

      if (useComposio) {
        try {
          const tools = await getToolsForAgent(summary.userId as unknown as string, 'interaction-agent');
          const createTool: any = tools.find((t: any) => typeof t?.name === 'string' && /google[_\- ]?docs?/i.test(t.name) && /create|document/i.test(t.name));
          if (createTool && typeof createTool.execute === 'function') {
            const res: any = await createTool.execute({ title, content: this.plainText(summary) });
            const storageLocation: StorageLocation = {
              id: `gdocs_${res?.id || generateId()}_${Date.now()}`,
              summaryId: summary.id,
              provider: 'google_docs',
              externalId: res?.id || 'unknown',
              url: res?.url,
              metadata: { pageTitle: title, permissions: options?.permissions || [] },
              createdAt: new Date()
            };
            if (isSupabaseEnabled()) await upsertStorageLocationSB({ id: storageLocation.id, summary_id: summary.id, provider: 'google_docs', external_id: storageLocation.externalId, url: storageLocation.url || null, metadata: storageLocation.metadata, created_at: storageLocation.createdAt.toISOString() });
            return storageLocation;
          }
        } catch (e) {
          console.error('[Google Docs Storage] Composio create failed, falling back:', e);
        }
      }

      // Fallback to direct Google APIs
      // Create the document
      const createResponse = await this.docs.documents.create({ requestBody: { title } });
      const documentId = createResponse.data.documentId as string;

      // Format and insert content
      const content = this.formatSummaryContent(summary);
      await this.docs.documents.batchUpdate({ documentId, requestBody: { requests: content } });

      if (options?.permissions) {
        for (const permission of options.permissions) {
          await this.drive.permissions.create({ fileId: documentId, requestBody: { role: permission.role, type: permission.type, emailAddress: permission.emailAddress } });
        }
      }

      const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

      const storageLocation: StorageLocation = {
        id: `gdocs_${documentId}_${Date.now()}`,
        summaryId: summary.id,
        provider: 'google_docs',
        externalId: documentId,
        url: docUrl,
        metadata: { pageTitle: title, permissions: options?.permissions || [] },
        createdAt: new Date()
      };
      if (isSupabaseEnabled()) await upsertStorageLocationSB({ id: storageLocation.id, summary_id: summary.id, provider: 'google_docs', external_id: storageLocation.externalId, url: storageLocation.url || null, metadata: storageLocation.metadata, created_at: storageLocation.createdAt.toISOString() });

      console.log(`[Google Docs Storage] Created document: ${docUrl}`);
      return storageLocation;

    } catch (error) {
      console.error('[Google Docs Storage] Create document error:', error);
      throw new Error(`Failed to create Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateDocument(storageLocation: StorageLocation, summary: Summary): Promise<void> {
    if (!this.docs) {
      throw new Error('Google Docs client not configured');
    }

    try {
      // Get current document content
      const doc = await this.docs.documents.get({
        documentId: storageLocation.externalId
      });

      // Clear existing content and insert new content
      const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;
      
      const requests = [
        {
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: endIndex
            }
          }
        },
        ...this.formatSummaryContent(summary)
      ];

      await this.docs.documents.batchUpdate({
        documentId: storageLocation.externalId,
        requestBody: {
          requests: requests
        }
      });

      console.log(`[Google Docs Storage] Updated document: ${storageLocation.externalId}`);

    } catch (error) {
      console.error('[Google Docs Storage] Update document error:', error);
      throw new Error(`Failed to update Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDocument(storageLocation: StorageLocation): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not configured');
    }

    try {
      // Move to trash (Google Docs doesn't support permanent deletion via API)
      await this.drive.files.update({
        fileId: storageLocation.externalId,
        requestBody: {
          trashed: true
        }
      });

      console.log(`[Google Docs Storage] Trashed document: ${storageLocation.externalId}`);

    } catch (error) {
      console.error('[Google Docs Storage] Delete document error:', error);
      throw new Error(`Failed to delete Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDocument(storageLocation: StorageLocation): Promise<any> {
    if (!this.docs) {
      throw new Error('Google Docs client not configured');
    }

    try {
      const doc = await this.docs.documents.get({
        documentId: storageLocation.externalId
      });

      return doc.data;

    } catch (error) {
      console.error('[Google Docs Storage] Get document error:', error);
      throw new Error(`Failed to get Google Doc: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatSummaryContent(summary: Summary): any[] {

    const requests: any[] = [];
    let currentIndex = 1;

    // Insert title
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: '📝 Summary\n\n'
      }
    });
    currentIndex += 12;

    // Format title as heading
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: 1,
          endIndex: 11
        },
        textStyle: {
          fontSize: { magnitude: 18, unit: 'PT' },
          bold: true
        },
        fields: 'fontSize,bold'
      }
    });

    // Insert summary content
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: summary.summary + '\n\n'
      }
    });
    currentIndex += summary.summary.length + 2;

    // Add key points section
    if (summary.keyPoints && summary.keyPoints.length > 0) {
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '🔑 Key Points\n\n'
        }
      });
      const keyPointsStart = currentIndex;
      currentIndex += 16;

      // Format key points heading
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: keyPointsStart,
            endIndex: keyPointsStart + 14
          },
          textStyle: {
            fontSize: { magnitude: 14, unit: 'PT' },
            bold: true
          },
          fields: 'fontSize,bold'
        }
      });

      // Insert key points as bullet list
      summary.keyPoints.forEach(point => {
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: `• ${point}\n`
          }
        });
        currentIndex += point.length + 3;
      });

      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: '\n'
        }
      });
      currentIndex += 1;
    }

    // Add metadata section
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: '📊 Metadata\n\n'
      }
    });
    const metadataStart = currentIndex;
    currentIndex += 14;

    // Format metadata heading
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: metadataStart,
          endIndex: metadataStart + 12
        },
        textStyle: {
          fontSize: { magnitude: 14, unit: 'PT' },
          bold: true
        },
        fields: 'fontSize,bold'
      }
    });

    // Insert metadata
    const metadata = [
      `AI Model: ${summary.aiModel || 'Unknown'}`,
      `Confidence: ${summary.confidence || 0}%`,
      `Sentiment: ${summary.sentiment || 'neutral'}`,
      `Topics: ${summary.topics?.join(', ') || 'None'}`,
      `Created: ${summary.createdAt.toLocaleDateString()}`
    ];

    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: metadata.join('\n') + '\n'
      }
    });

    return requests;
  }

  private plainText(summary: Summary): string {
    const lines: string[] = [];
    lines.push('Summary');
    lines.push(summary.summary);
    if (summary.keyPoints?.length) {
      lines.push('\nKey Points:');
      for (const p of summary.keyPoints) lines.push(`- ${p}`);
    }
    lines.push(`\nSentiment: ${summary.sentiment || 'neutral'}`);
    if (summary.topics?.length) lines.push(`Topics: ${summary.topics.join(', ')}`);
    lines.push(`Created: ${summary.createdAt.toISOString()}`);
    return lines.join('\n');
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
