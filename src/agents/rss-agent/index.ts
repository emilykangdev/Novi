import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db } from '../../database/connection';
import { contentSources, contentItems, summaries } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import Parser from 'rss-parser';
import { getToolsForAgent, isComposioEnabled } from '../../integrations/composio';
import { isSupabaseEnabled, upsertContentItemSB, upsertSummarySB } from '../../database/supabase';
import type { RSSItem } from '../../shared/types';

/**
 * RSS Feed Monitoring Agent
 * 
 * Monitors RSS feeds and summarizes articles.
 * Handles various RSS/Atom feed formats.
 * 
 * Capabilities:
 * - Monitor RSS feeds for new articles
 * - Extract article content
 * - Generate AI summaries with key insights
 * - Store summaries in database and external storage
 */

interface RSSAgentRequest {
  action: 'ping' | 'monitor' | 'summarize' | 'parse_feed';
  sourceId?: string;
  contentItemId?: string;
  userId?: string;
  feedUrl?: string;
  force?: boolean;
}

// Initialize RSS parser
const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'description', 'summary']
  }
});

// Initialize AI model for summarization
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Summarization prompt template
const summaryPrompt = PromptTemplate.fromTemplate(`
You are an expert content summarizer. Create a comprehensive summary of this article.

Title: {title}
Author: {author}
Published: {publishedAt}
Content: {content}

Please provide:
1. A concise summary (2-3 paragraphs)
2. Key points (3-5 bullet points)
3. Main topics/themes
4. Overall sentiment (positive/negative/neutral)

Format your response as JSON:
{{
  "summary": "Your summary here...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "topics": ["Topic 1", "Topic 2"],
  "sentiment": "positive|negative|neutral",
  "confidence": 85
}}
`);

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const request: RSSAgentRequest = await req.json();
    
    console.log(`[RSS Agent] Processing action: ${request.action}`);

    switch (request.action) {
      case 'ping':
        return resp.json({ success: true, agent: 'rss-agent', timestamp: new Date().toISOString() });
      
      case 'monitor':
        return await handleMonitoring(resp, ctx, request);
      
      case 'summarize':
        return await handleSummarization(resp, ctx, request);
      
      case 'parse_feed':
        return await handleFeedParsing(resp, ctx, request);
      
      default:
        return resp.json({
          success: false,
          error: `Unknown action: ${request.action}`,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[RSS Agent] Error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleMonitoring(resp: AgentResponse, ctx: AgentContext, request: RSSAgentRequest) {
  try {
    if (!request.sourceId) {
      return resp.json({
        success: false,
        error: 'sourceId is required for monitoring',
        timestamp: new Date().toISOString()
      });
    }

    // Get the RSS feed source
    const source = await db
      .select()
      .from(contentSources)
      .where(and(
        eq(contentSources.id, request.sourceId),
        eq(contentSources.type, 'rss')
      ))
      .limit(1);

    if (source.length === 0) {
      return resp.json({
        success: false,
        error: 'RSS source not found',
        timestamp: new Date().toISOString()
      });
    }

    const feedSource = source[0];
    const feedUrl = feedSource.metadata?.feedUrl || feedSource.url;

    const composioTools = isComposioEnabled() ? await getToolsForAgent(feedSource.userId, 'rss-agent') : [];

    // Parse the RSS feed
    const feed = await parser.parseURL(feedUrl);
    let newItems = 0;

    for (const item of feed.items) {
      // Check if we already have this article
      const existing = await db
        .select()
        .from(contentItems)
        .where(and(
          eq(contentItems.sourceId, request.sourceId),
          eq(contentItems.url, item.link || '')
        ))
        .limit(1);

      if (existing.length === 0 && item.link) {
        // Extract content from the item
        const content = extractContent(item);
        
        // Create new content item
        const newId = `article_${generateId()}_${Date.now()}`;
        await db.insert(contentItems).values({
          id: newId,
          sourceId: request.sourceId,
          type: 'article',
          title: item.title || 'Untitled',
          url: item.link || '',
          content: content,
          metadata: {
            author: item.creator || item['dc:creator'] || 'Unknown',
            publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
            tags: item.categories || []
          },
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          createdAt: new Date()
        });
        if (isSupabaseEnabled()) {
          await upsertContentItemSB({
            id: newId,
            source_id: request.sourceId,
            type: 'article',
            title: item.title || 'Untitled',
            url: item.link || '',
            content,
            metadata: {
              author: item.creator || (item as any)['dc:creator'] || 'Unknown',
              publishedAt: item.pubDate || (item as any).isoDate || new Date().toISOString(),
              tags: item.categories || []
            },
            published_at: (item.pubDate ? new Date(item.pubDate) : new Date()).toISOString(),
            created_at: new Date().toISOString()
          });
        }

        newItems++;
        console.log(`[RSS Agent] Added new article: ${item.title}`);
      }
    }

    // Update source metadata
    await db
      .update(contentSources)
      .set({
        metadata: {
          ...feedSource.metadata,
          lastChecked: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(contentSources.id, request.sourceId));

    return resp.json({
      success: true,
      data: {
        sourceId: request.sourceId,
        articlesChecked: feed.items.length,
        newItems: newItems,
        composio: { enabled: isComposioEnabled(), toolsAvailable: composioTools.length },
        feedTitle: feed.title
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RSS Agent] Monitoring error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleSummarization(resp: AgentResponse, ctx: AgentContext, request: RSSAgentRequest) {
  try {
    if (!request.contentItemId || !request.userId) {
      return resp.json({
        success: false,
        error: 'contentItemId and userId are required for summarization',
        timestamp: new Date().toISOString()
      });
    }

    // Get the content item
    const contentItem = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, request.contentItemId))
      .limit(1);

    if (contentItem.length === 0) {
      return resp.json({
        success: false,
        error: 'Content item not found',
        timestamp: new Date().toISOString()
      });
    }

    const item = contentItem[0];
    
    if (!item.content) {
      return resp.json({
        success: false,
        error: 'No content available for this article',
        timestamp: new Date().toISOString()
      });
    }

    // Generate summary using AI
    const prompt = await summaryPrompt.format({
      title: item.title,
      author: item.metadata?.author || 'Unknown',
      publishedAt: item.metadata?.publishedAt || 'Unknown',
      content: item.content.slice(0, 8000) // Limit content length
    });

    const response = await llm.invoke(prompt);
    const summaryData = JSON.parse(response.content as string);

    // Save summary to database
    const summaryId = `summary_${item.id}_${Date.now()}`;
    await db.insert(summaries).values({
      id: summaryId,
      contentItemId: request.contentItemId,
      userId: request.userId,
      summary: summaryData.summary,
      keyPoints: summaryData.keyPoints,
      sentiment: summaryData.sentiment,
      topics: summaryData.topics,
      aiModel: 'gpt-4o-mini',
      confidence: summaryData.confidence,
      createdAt: new Date()
    });

    if (isSupabaseEnabled()) {
      await upsertSummarySB({
        id: summaryId,
        content_item_id: request.contentItemId,
        user_id: request.userId,
        summary: summaryData.summary,
        key_points: summaryData.keyPoints ?? null,
        sentiment: summaryData.sentiment ?? null,
        topics: summaryData.topics ?? null,
        ai_model: 'gpt-4o-mini',
        confidence: summaryData.confidence ?? null,
        created_at: new Date().toISOString()
      });
    }

    return resp.json({
      success: true,
      data: {
        summaryId: summaryId,
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints,
        topics: summaryData.topics,
        sentiment: summaryData.sentiment,
        confidence: summaryData.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RSS Agent] Summarization error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleFeedParsing(resp: AgentResponse, ctx: AgentContext, request: RSSAgentRequest) {
  try {
    if (!request.feedUrl) {
      return resp.json({
        success: false,
        error: 'feedUrl is required for feed parsing',
        timestamp: new Date().toISOString()
      });
    }

    const feed = await parser.parseURL(request.feedUrl);
    
    return resp.json({
      success: true,
      data: {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        itemCount: feed.items.length,
        items: feed.items.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          author: item.creator || item['dc:creator']
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[RSS Agent] Feed parsing error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Feed parsing failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Helper functions
function extractContent(item: any): string {
  // Try different content fields in order of preference
  const contentFields = [
    'content:encoded',
    'content',
    'description',
    'summary',
    'contentSnippet'
  ];
  
  for (const field of contentFields) {
    if (item[field]) {
      return stripHtml(item[field]);
    }
  }
  
  return '';
}

function stripHtml(html: string): string {
  // Basic HTML stripping - in production, use a proper HTML parser
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
