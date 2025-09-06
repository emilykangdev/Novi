import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import { db } from '../../database/connection';
import { contentSources, contentItems, summaries } from '../../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { getToolsForAgent, isComposioEnabled } from '../../integrations/composio';
import { isSupabaseEnabled, upsertContentItemSB, upsertSummarySB } from '../../database/supabase';

/**
 * Newsletter Processing Agent
 * 
 * Processes email newsletters and extracts key insights.
 * Handles various newsletter formats and email parsing.
 * 
 * Capabilities:
 * - Monitor email newsletters
 * - Extract newsletter content
 * - Generate AI summaries with key insights
 * - Store summaries in database and external storage
 */

interface NewsletterAgentRequest {
  action: 'ping' | 'monitor' | 'summarize' | 'process_email';
  sourceId?: string;
  contentItemId?: string;
  userId?: string;
  emailContent?: string;
  force?: boolean;
}

// Initialize AI model for summarization
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Newsletter summarization prompt template
const summaryPrompt = PromptTemplate.fromTemplate(`
You are an expert newsletter summarizer. Create a comprehensive summary of this newsletter.

Newsletter Title: {title}
Sender: {sender}
Date: {date}
Content: {content}

Please provide:
1. A concise summary (2-3 paragraphs)
2. Key insights and takeaways (3-5 bullet points)
3. Main topics/themes covered
4. Overall sentiment and tone
5. Any actionable items or recommendations

Format your response as JSON:
{{
  "summary": "Your summary here...",
  "keyPoints": ["Insight 1", "Insight 2", "Insight 3"],
  "topics": ["Topic 1", "Topic 2"],
  "sentiment": "positive|negative|neutral",
  "actionableItems": ["Action 1", "Action 2"],
  "confidence": 85
}}
`);

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const request: NewsletterAgentRequest = await req.json();
    
    console.log(`[Newsletter Agent] Processing action: ${request.action}`);

    switch (request.action) {
      case 'ping':
        return resp.json({ success: true, agent: 'newsletter-agent', timestamp: new Date().toISOString() });
      
      case 'monitor':
        return await handleMonitoring(resp, ctx, request);
      
      case 'summarize':
        return await handleSummarization(resp, ctx, request);
      
      case 'process_email':
        return await handleEmailProcessing(resp, ctx, request);
      
      default:
        return resp.json({
          success: false,
          error: `Unknown action: ${request.action}`,
          timestamp: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[Newsletter Agent] Error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleMonitoring(resp: AgentResponse, ctx: AgentContext, request: NewsletterAgentRequest) {
  try {
    if (!request.sourceId) {
      return resp.json({
        success: false,
        error: 'sourceId is required for monitoring',
        timestamp: new Date().toISOString()
      });
    }

    // Get the newsletter source
    const source = await db
      .select()
      .from(contentSources)
      .where(and(
        eq(contentSources.id, request.sourceId),
        eq(contentSources.type, 'newsletter')
      ))
      .limit(1);

    if (source.length === 0) {
      return resp.json({
        success: false,
        error: 'Newsletter source not found',
        timestamp: new Date().toISOString()
      });
    }

    const newsletterSource = source[0];

    const composioTools = isComposioEnabled() ? await getToolsForAgent(newsletterSource.userId, 'newsletter-agent') : [];
    
    // TODO: Implement email monitoring integration
    // This would typically involve:
    // 1. Connecting to email provider (Gmail, Outlook, etc.)
    // 2. Searching for emails from specific senders
    // 3. Processing new newsletters
    
    console.log(`[Newsletter Agent] Monitoring newsletter source: ${newsletterSource.name}`);
    
    // For now, attempt to use Composio Gmail tools to gauge new messages, otherwise fallback
    let newItems = 0;
    try {
      if (composioTools.length > 0) {
        const listTool: any = composioTools.find((t: any) =>
          typeof t?.name === 'string' && /gmail|mail/i.test(t.name) && /list|messages|threads/i.test(t.name)
        );
        const getTool: any = composioTools.find((t: any) =>
          typeof t?.name === 'string' && /gmail|mail/i.test(t.name) && /get|read/i.test(t.name) && /message|thread/i.test(t.name)
        );
        if (listTool && typeof listTool.execute === 'function') {
          const res: any = await listTool.execute({ q: 'newer_than:7d' });
          const messages = Array.isArray(res?.messages) ? res.messages : (Array.isArray(res) ? res : []);
          for (const m of messages.slice(0, 10)) {
            const id = m.id || m.messageId || m.threadId;
            if (!id) continue;
            // dedupe by gmail:message:id URL
            const existing = await db
              .select()
              .from(contentItems)
              .where(and(eq(contentItems.sourceId, request.sourceId), eq(contentItems.url, `gmail:message:${id}`)))
              .limit(1);
            if (existing.length > 0) continue;
            let subject = 'Newsletter';
            let from = 'Unknown';
            let date = new Date().toISOString();
            let text = '';
            if (getTool && typeof getTool.execute === 'function') {
              try {
                const full: any = await getTool.execute({ id });
                subject = full?.subject || subject;
                from = full?.from || from;
                date = full?.date || date;
                text = full?.text || full?.snippet || text;
              } catch (e) {
                // ignore
              }
            }
            const contentId = `newsletter_${generateId()}_${Date.now()}`;
            await db.insert(contentItems).values({
              id: contentId,
              sourceId: request.sourceId,
              type: 'newsletter',
              title: subject,
              url: `gmail:message:${id}`,
              content: text,
              metadata: { author: from, publishedAt: date, gmailMessageId: id },
              publishedAt: new Date(date),
              createdAt: new Date()
            });
            if (isSupabaseEnabled()) {
              await upsertContentItemSB({
                id: contentId,
                source_id: request.sourceId,
                type: 'newsletter',
                title: subject,
                url: `gmail:message:${id}`,
                content: text,
                metadata: { author: from, publishedAt: date, gmailMessageId: id },
                published_at: new Date(date).toISOString(),
                created_at: new Date().toISOString()
              });
            }
            newItems++;
          }
        }
      }
    } catch (e) {
      console.error('[Newsletter Agent] Composio Gmail check failed:', e);
    }

    // Update source metadata
    await db
      .update(contentSources)
      .set({
        metadata: {
          ...newsletterSource.metadata,
          lastChecked: new Date().toISOString()
        },
        updatedAt: new Date()
      })
      .where(eq(contentSources.id, request.sourceId));

    return resp.json({
      success: true,
      data: {
        sourceId: request.sourceId,
        newItems: newItems,
        composio: { enabled: isComposioEnabled(), toolsAvailable: composioTools.length },
        message: 'Newsletter monitoring completed (email integration pending)'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Newsletter Agent] Monitoring error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Monitoring failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleSummarization(resp: AgentResponse, ctx: AgentContext, request: NewsletterAgentRequest) {
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
        error: 'No content available for this newsletter',
        timestamp: new Date().toISOString()
      });
    }

    // Generate summary using AI
    const prompt = await summaryPrompt.format({
      title: item.title,
      sender: item.metadata?.author || 'Unknown',
      date: item.metadata?.publishedAt || 'Unknown',
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
        actionableItems: summaryData.actionableItems || [],
        confidence: summaryData.confidence
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Newsletter Agent] Summarization error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
      timestamp: new Date().toISOString()
    });
  }
}

async function handleEmailProcessing(resp: AgentResponse, ctx: AgentContext, request: NewsletterAgentRequest) {
  try {
    if (!request.emailContent || !request.sourceId) {
      return resp.json({
        success: false,
        error: 'emailContent and sourceId are required for email processing',
        timestamp: new Date().toISOString()
      });
    }

    // Parse email content
    const emailData = parseEmailContent(request.emailContent);
    
    // Create content item
    const contentItemId = `newsletter_${generateId()}_${Date.now()}`;
    await db.insert(contentItems).values({
      id: contentItemId,
      sourceId: request.sourceId,
      type: 'newsletter',
      title: emailData.subject,
      content: emailData.textContent,
      metadata: {
        author: emailData.from,
        publishedAt: emailData.date,
        tags: emailData.tags || []
      },
      publishedAt: new Date(emailData.date),
      createdAt: new Date()
    });

    if (isSupabaseEnabled()) {
      await upsertContentItemSB({
        id: contentItemId,
        source_id: request.sourceId,
        type: 'newsletter',
        title: emailData.subject,
        url: `gmail:message:${emailData.subject}`,
        content: emailData.textContent,
        metadata: { author: emailData.from, publishedAt: emailData.date, tags: emailData.tags || [] },
        published_at: new Date(emailData.date).toISOString(),
        created_at: new Date().toISOString()
      });
    }

    return resp.json({
      success: true,
      data: {
        contentItemId: contentItemId,
        title: emailData.subject,
        from: emailData.from,
        date: emailData.date
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Newsletter Agent] Email processing error:', error);
    return resp.json({
      success: false,
      error: error instanceof Error ? error.message : 'Email processing failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Helper functions
interface EmailData {
  subject: string;
  from: string;
  date: string;
  textContent: string;
  htmlContent?: string;
  tags?: string[];
}

function parseEmailContent(emailContent: string): EmailData {
  // Basic email parsing - in production, use a proper email parser
  const lines = emailContent.split('\n');
  let subject = '';
  let from = '';
  let date = '';
  let textContent = '';
  let inBody = false;

  for (const line of lines) {
    if (line.startsWith('Subject:')) {
      subject = line.substring(8).trim();
    } else if (line.startsWith('From:')) {
      from = line.substring(5).trim();
    } else if (line.startsWith('Date:')) {
      date = line.substring(5).trim();
    } else if (line.trim() === '' && !inBody) {
      inBody = true;
    } else if (inBody) {
      textContent += line + '\n';
    }
  }

  return {
    subject: subject || 'Untitled Newsletter',
    from: from || 'Unknown Sender',
    date: date || new Date().toISOString(),
    textContent: textContent.trim()
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
