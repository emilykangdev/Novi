import { google } from 'googleapis';
import type { StorageProvider, StorageOptions } from './index';
import type { Summary, StorageLocation } from '../shared/types';

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
      const title = options?.title || `Summary - ${summary.summary.substring(0, 50)}...`;
      
      // Create the document
      const createResponse = await this.docs.documents.create({
        requestBody: {
          title: title
        }
      });

      const documentId = createResponse.data.documentId;
      
      // Format and insert content
      const content = this.formatSummaryContent(summary);
      
      await this.docs.documents.batchUpdate({
        documentId: documentId,
        requestBody: {
          requests: content
        }
      });

      // Set permissions if specified
      if (options?.permissions) {
        for (const permission of options.permissions) {
          await this.drive.permissions.create({
            fileId: documentId,
            requestBody: {
              role: permission.role,
              type: permission.type,
              emailAddress: permission.emailAddress
            }
          });
        }
      }

      // Get the document URL
      const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

      // Create storage location record
      const storageLocation: StorageLocation = {
        id: `gdocs_${documentId}_${Date.now()}`,
        summaryId: summary.id,
        provider: 'google_docs',
        externalId: documentId,
        url: docUrl,
        metadata: {
          pageTitle: title,
          permissions: options?.permissions || []
        },
        createdAt: new Date()
      };

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
}
